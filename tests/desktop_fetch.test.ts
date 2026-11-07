import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FetchRequest } from '@x-tech-laboratories/x-libs/electron/fetch'

import { desktop_fetch, is_desktop } from '../src/utils/desktop'

// Stands in for the preload's bridge and records what the page asked the main process to fetch.
const http_fetch = vi.fn(async (_request: FetchRequest) => ({
  status: 200,
  status_text: 'OK',
  headers: [['content-type', 'application/json']] as [string, string][],
  body: new TextEncoder().encode('{}'),
}))

function sent(): FetchRequest {
  return http_fetch.mock.calls[0][0]
}

function sent_headers(): Headers {
  return new Headers(sent().headers)
}

beforeEach(() => {
  http_fetch.mockClear()
  window.x_stream = { http_fetch, freetube_scan: vi.fn(), freetube_read_data: vi.fn() }
})

afterEach(() => {
  delete window.x_stream
})

describe('desktop_fetch', () => {
  it('knows it runs in the desktop app once the bridge is there', () => {
    expect(is_desktop()).toBe(true)
    delete window.x_stream
    expect(is_desktop()).toBe(false)
  })

  // InnerTube answers 403 to any cross-origin value, so these are set, never left to the page.
  it('pins Origin and Referer to youtube.com', async () => {
    await desktop_fetch('https://www.youtube.com/youtubei/v1/search')
    expect(sent_headers().get('Origin')).toBe('https://www.youtube.com')
    expect(sent_headers().get('Referer')).toBe('https://www.youtube.com/')
  })

  it('overrides a caller-supplied Origin', async () => {
    await desktop_fetch('https://www.youtube.com/youtubei/v1/search', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(sent_headers().get('Origin')).toBe('https://www.youtube.com')
  })

  it('preserves other headers and the method', async () => {
    await desktop_fetch('https://www.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Visitor-Id': 'abc' },
      body: '{"query":"test"}',
    })
    expect(sent().method).toBe('POST')
    expect(sent_headers().get('Content-Type')).toBe('application/json')
    expect(sent_headers().get('X-Goog-Visitor-Id')).toBe('abc')
  })

  it('forwards the request body, and none for GET', async () => {
    await desktop_fetch('https://www.youtube.com/youtubei/v1/search', { method: 'POST', body: '{"query":"lofi"}' })
    await desktop_fetch('https://i.ytimg.com/vi/abc/hqdefault.jpg')
    expect(new TextDecoder().decode(http_fetch.mock.calls[0][0].body)).toBe('{"query":"lofi"}')
    expect(http_fetch.mock.calls[1][0].body).toBeUndefined()
  })

  it('repairs a comment payload on the way back', async () => {
    const payload = { commentRepliesRenderer: { contents: [], subThreads: [{ id: 'reply' }] } }
    http_fetch.mockResolvedValueOnce({
      status: 200,
      status_text: 'OK',
      headers: [['content-type', 'application/json']],
      body: new TextEncoder().encode(JSON.stringify(payload)),
    })
    const response = await desktop_fetch('https://www.youtube.com/youtubei/v1/next')
    expect((await response.json()).commentRepliesRenderer.contents).toEqual([{ id: 'reply' }])
  })
})
