// Video sources as plugins on X-Libs' plugin host: each plugin provides a video_source, and the one picked in the settings is in use.

import { create_plugin_host, define_plugin, json_plugin_storage, type PluginHost } from '@x-tech-laboratories/x-libs/plugins'
import { browser_storage } from '@x-tech-laboratories/x-libs/web/prefs'
import packageJson from '../../package.json'
import type { VideoPlugin } from './types'
import { YoutubeJsPlugin } from './youtubejs/index'

// What X-Stream lets its plugins reach.
export interface XStreamApi {
  providers: { video_source: VideoPlugin }
}

export type XStreamPluginHost = PluginHost<XStreamApi>

export function createPluginManager(host: XStreamPluginHost) {
  let activeId: string | null = null
  const sources = () => host.providers('video_source').map(provided => provided.value)

  return {
    host,
    list: sources,
    get: (id: string) => sources().find(source => source.id === id),

    setActive(id: string): void {
      if (!sources().some(source => source.id === id)) throw new Error(`Plugin "${id}" is not registered`)
      activeId = id
    },

    // The picked source, or the first one while the picked one is off or gone.
    getActive(): VideoPlugin {
      const provided = host.provider('video_source', activeId ?? undefined)
      if (!provided) throw new Error('No plugins registered')
      return provided.value
    },

    async autoSelect(): Promise<VideoPlugin> {
      for (const source of sources()) {
        if (await source.isAvailable()) {
          activeId = source.id
          return source
        }
      }
      throw new Error('No available plugins found')
    },
  }
}

export const youtubeJsPlugin = define_plugin<XStreamApi>({
  id: 'x-stream.youtubejs',
  name: 'youtube.js (Local)',
  version: packageJson.version,
  app: 'x-stream',
  description: 'Reverse-engineered YouTube client. Runs in the page; the desktop app sends its requests from the main process.',
  start: context => context.provide('video_source', 'youtubejs', new YoutubeJsPlugin()),
})

const storage = browser_storage()
export const pluginHost: XStreamPluginHost = create_plugin_host<XStreamApi>({
  app: { id: 'x-stream', version: packageJson.version },
  storage: storage && json_plugin_storage({ get: () => storage.getItem('x-stream.plugins'), set: text => storage.setItem('x-stream.plugins', text) }),
  on_error: (pluginId, error) => console.warn(`plugin ${pluginId}:`, error),
})

// Singleton — import this everywhere
export const pluginManager = createPluginManager(pluginHost)

// Adds the bundled plugins and starts those that are on.
export async function startPlugins(): Promise<void> {
  await pluginHost.add(youtubeJsPlugin)
  await pluginHost.start()
}
