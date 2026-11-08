// The desktop app's calls into its main process: YouTube requests, opening links and the FreeTube import.

import type { Client } from '@x-tech-laboratories/x-libs/electron/bridge'
import type { EventsClient } from '@x-tech-laboratories/x-libs/electron/events'
import { create_page_fetch, create_page_stream_fetch } from '@x-tech-laboratories/x-libs/electron/fetch'

import type { FreetubeData, XStreamApi, XStreamEvents } from '../shared/bridge.ts'

export type { FreetubeData } from '../shared/bridge.ts'

declare global {
  interface Window {
    x_stream?: Client<XStreamApi>
    x_stream_events?: EventsClient<XStreamEvents>
  }
}

// ============================================================================
// Desktop detection
// ============================================================================

// True inside the Electron app, whose preload puts the bridge on the window.
export function is_desktop(): boolean {
  return typeof window !== 'undefined' && window.x_stream !== undefined
}

function desktop_api(): Client<XStreamApi> {
  if (!window.x_stream) throw new Error('This needs the X-Stream desktop app')
  return window.x_stream
}

function desktop_events(): EventsClient<XStreamEvents> {
  if (!window.x_stream_events) throw new Error('This needs the X-Stream desktop app')
  return window.x_stream_events
}

// ============================================================================
// YouTube payload repairs
// ============================================================================

// Patches two comment payload shapes the parser trips on: a missing avatar, and replies moved to subThreads.
export function repairYouTubePayload(node: unknown): void {
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, any>

  const mutations = obj.frameworkUpdates?.entityBatchUpdate?.mutations
  if (Array.isArray(mutations)) {
    for (const mutation of mutations) {
      const comment = mutation?.payload?.commentEntityPayload
      if (comment && comment.author && !comment.avatar) {
        comment.avatar = { endpoint: undefined, image: { sources: [] } }
      }
    }
  }

  const replies = obj.commentRepliesRenderer
  if (replies && !replies.contents?.length && Array.isArray(replies.subThreads)) {
    replies.contents = replies.subThreads
  }

  for (const value of Array.isArray(obj) ? obj : Object.values(obj)) {
    repairYouTubePayload(value)
  }
}

// ============================================================================
// Fetch
// ============================================================================

const YT_ORIGIN = 'https://www.youtube.com'

// InnerTube refuses any origin but its own, so Origin and Referer are pinned to youtube.com.
const pinned_headers = { Origin: YT_ORIGIN, Referer: `${YT_ORIGIN}/` }

const page_fetch = create_page_fetch((request) => desktop_api().http_fetch(request), { pinned_headers })

// Its Response body streams from the main process chunk by chunk, so the player decodes a segment while the rest is still arriving.
export const desktop_stream_fetch = create_page_stream_fetch({
  start: (request) => desktop_api().http_stream(request),
  cancel: (stream_id) => desktop_api().http_stream_cancel(stream_id),
  on_chunk: (handler) => desktop_events().on('stream_chunk', handler),
}, { pinned_headers })

// A fetch sent from the main process, with YouTube's JSON repaired on the way.
export async function desktop_fetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await page_fetch(input as string | URL | Request, init)

  // Only InnerTube responses need repairing, and only JSON ones can be.
  if (!response.headers.get('content-type')?.includes('json')) return response

  const text = await response.text()
  try {
    const data = JSON.parse(text)
    repairYouTubePayload(data)
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } catch {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}

// ============================================================================
// Links
// ============================================================================

// The desktop window hands new windows to the default browser.
export function openInBrowser(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ============================================================================
// FreeTube import
// ============================================================================

export function freetubeScan(): Promise<string[]> {
  return desktop_api().freetube_scan()
}

export function freetubeReadData(directory: string): Promise<FreetubeData> {
  return desktop_api().freetube_read_data(directory)
}
