// The calls the page makes to the desktop app's main process.

import { define_bridge } from '@x-tech-laboratories/x-libs/electron/bridge'
import type { FetchMethod } from '@x-tech-laboratories/x-libs/electron/fetch'

// ============================================================================
// FreeTube import
// ============================================================================

export interface FreetubeSubscription {
  id: string
  name: string
  thumbnail: string
}

export interface FreetubeHistoryEntry {
  videoId: string
  title: string
  channelId: string
  channelName: string
  thumbnail: string
  duration: number
  watchedAt: string
}

export interface FreetubeData {
  subscriptions: FreetubeSubscription[]
  history: FreetubeHistoryEntry[]
}

// ============================================================================
// Bridge
// ============================================================================

export interface XStreamApi {
  http_fetch: FetchMethod
  freetube_scan(): string[]
  freetube_read_data(directory: string): FreetubeData
}

export const x_stream_bridge = define_bridge<XStreamApi>('x_stream', ['http_fetch', 'freetube_scan', 'freetube_read_data'])

// The only hosts the main process fetches for the page, since the page also runs YouTube's scripts.
export const YOUTUBE_HOSTS = [
  'www.youtube.com',
  'music.youtube.com',
  'i.ytimg.com',
  'yt3.ggpht.com',
  'yt3.googleusercontent.com',
  'jnn-pa.googleapis.com',
  '*.googlevideo.com',
]
