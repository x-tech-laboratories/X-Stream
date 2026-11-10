import { describe, it, expect, beforeEach } from 'vitest'
import { create_plugin_host, define_plugin } from '@x-tech-laboratories/x-libs/plugins'
import { createPluginManager, youtubeJsPlugin, type XStreamApi } from '../src/plugins/manager'
import type { VideoPlugin, VideoInfo, SearchResult, ChannelInfo } from '../src/plugins/types'

// Minimal stub source for testing the manager in isolation
function makeStub(id: string, available: boolean): VideoPlugin {
  return {
    id,
    name: id,
    description: '',
    isAvailable: () => Promise.resolve(available),
    getVideoInfo: () => Promise.resolve({} as VideoInfo),
    search: () => Promise.resolve([] as SearchResult[]),
    getChannelInfo: () => Promise.resolve({} as ChannelInfo),
  }
}

function sourcePlugin(source: VideoPlugin) {
  return define_plugin<XStreamApi>({ id: `test.${source.id}`, name: source.id, version: '1.0.0', start: context => context.provide('video_source', source.id, source) })
}

describe('PluginManager', () => {
  let host: ReturnType<typeof create_plugin_host<XStreamApi>>
  let manager: ReturnType<typeof createPluginManager>

  beforeEach(() => {
    host = create_plugin_host<XStreamApi>({ app: { id: 'x-stream', version: '1.0.0' } })
    manager = createPluginManager(host)
  })

  async function register(...sources: VideoPlugin[]) {
    for (const source of sources) await host.add(sourcePlugin(source))
    await host.start()
  }

  it('lists the sources running plugins provide', async () => {
    await register(makeStub('a', true), makeStub('b', true))
    expect(manager.list().map(p => p.id)).toEqual(['a', 'b'])
    expect(manager.get('b')?.id).toBe('b')
  })

  it('setActive throws for unknown source', async () => {
    await register(makeStub('a', true))
    expect(() => manager.setActive('ghost')).toThrow('Plugin "ghost" is not registered')
  })

  it('setActive selects the named source', async () => {
    await register(makeStub('a', true), makeStub('b', true))
    manager.setActive('b')
    expect(manager.getActive().id).toBe('b')
  })

  it('getActive falls back to the first source when none is set or the set one is turned off', async () => {
    await register(makeStub('first', true), makeStub('second', true))
    expect(manager.getActive().id).toBe('first')

    manager.setActive('second')
    await host.disable('test.second')
    expect(manager.getActive().id).toBe('first')
  })

  it('getActive throws when no source is running', async () => {
    await register()
    expect(() => manager.getActive()).toThrow('No plugins registered')
  })

  it('autoSelect picks the first available source', async () => {
    await register(makeStub('unavailable', false), makeStub('available', true))
    expect((await manager.autoSelect()).id).toBe('available')
    expect(manager.getActive().id).toBe('available')
  })

  it('autoSelect throws when no source is available', async () => {
    await register(makeStub('a', false))
    await expect(manager.autoSelect()).rejects.toThrow('No available plugins found')
  })

  it('the bundled youtube.js plugin provides the youtubejs source', async () => {
    await host.add(youtubeJsPlugin)
    await host.start()
    expect(host.list()[0]?.state).toBe('running')
    expect(manager.getActive().id).toBe('youtubejs')
  })
})
