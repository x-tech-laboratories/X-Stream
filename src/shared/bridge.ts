// The calls the page makes to the desktop app's main process.

import { define_bridge } from '@x-tech-laboratories/x-libs/electron/bridge'
import { define_events } from '@x-tech-laboratories/x-libs/electron/events'
import type { FetchMethod, StreamCancelMethod, StreamChunk, StreamStartMethod } from '@x-tech-laboratories/x-libs/electron/fetch'

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
  http_stream: StreamStartMethod
  http_stream_cancel: StreamCancelMethod
  freetube_scan(): string[]
  freetube_read_data(directory: string): FreetubeData
}

export const x_stream_bridge = define_bridge<XStreamApi>('x_stream', ['http_fetch', 'http_stream', 'http_stream_cancel', 'freetube_scan', 'freetube_read_data'])

// The pieces of a streamed response, pushed to the page as they arrive.
export type XStreamEvents = {
  stream_chunk: StreamChunk
}

export const x_stream_events = define_events<XStreamEvents>('x_stream_events')

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
