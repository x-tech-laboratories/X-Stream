// The calls the page makes to the desktop app's main process.

import { define_bridge } from '@x-tech-laboratories/x-libs/electron/bridge'
import { define_events } from '@x-tech-laboratories/x-libs/electron/events'
import type { FetchMethod, StreamCancelMethod, StreamChunk, StreamStartMethod } from '@x-tech-laboratories/x-libs/electron/fetch'
import { backup_method_names, type BackupMethods } from '@x-tech-laboratories/x-libs/backup_protocol'
import { history_method_names, type HistoryMethods } from '@x-tech-laboratories/x-libs/history'

import type { PersonalPlaylist } from '../types/index.ts'
import type { AllDocsOptions, AllDocsResult, PutResult, Saved, StoredDocument } from './documents.ts'

// A personal playlist as its history keeps it, without the revision that changes on every write.
export type PlaylistSnapshot = Omit<PersonalPlaylist, '_rev'>

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
  // Null for a missing document, which the page turns into PouchDB's not-found error, since a miss is routine for the
  // cache and Electron logs every error a handler throws.
  documents_get(id: string): Saved<unknown> | null
  documents_put(document: StoredDocument): PutResult
  documents_remove(id: string, rev: string | undefined): PutResult
  documents_all(options: AllDocsOptions): AllDocsResult<unknown>
  documents_bulk(documents: StoredDocument[]): PutResult[]
  // Whether the documents the page kept in its own browser storage, before they moved here, are still to be brought over.
  documents_need_import(): boolean
  documents_import(documents: StoredDocument[]): number
}

export const x_stream_bridge = define_bridge<XStreamApi>('x_stream', [
  'http_fetch', 'http_stream', 'http_stream_cancel', 'freetube_scan', 'freetube_read_data',
  'documents_get', 'documents_put', 'documents_remove', 'documents_all', 'documents_bulk', 'documents_need_import', 'documents_import',
])

// The settings page's calls on this device: its backups and the playlists' history.
export type XStreamDeviceApi = BackupMethods & HistoryMethods<PlaylistSnapshot>

export const x_stream_device_bridge = define_bridge<XStreamDeviceApi>('x_stream_device', [...backup_method_names, ...history_method_names])

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
