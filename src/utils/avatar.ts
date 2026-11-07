import { is_desktop, desktop_fetch } from './desktop'

// Fetches an image as a base64 data URI for PouchDB, or null outside the desktop app where YouTube's image hosts are cross-origin.
export async function downloadAvatar(url: string): Promise<string | null> {
  if (!url || !is_desktop()) return null
  try {
    const response = await desktop_fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') ?? 'image/jpeg'

    let binary = ''
    const bytes = new Uint8Array(buffer)
    // Chunked to avoid blowing the argument limit on large images.
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return `data:${contentType};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

/**
 * Strips inlined base64 thumbnails, leaving plain URLs.
 *
 * Video thumbnails used to be downloaded and stored as data URIs, which cost
 * one request per thumbnail on every refresh (256 for a 32-channel feed) and
 * bloated every PouchDB read. `<img loading="lazy">` fetches and caches them
 * far more efficiently, and offscreen ones are never requested at all.
 *
 * Channel avatars still use {@link downloadAvatar}: there are few of them and
 * they render on every page via the sidebar.
 */
export function thumbnailUrl(thumbnail: string, videoId: string): string {
  if (thumbnail && !thumbnail.startsWith('data:')) return thumbnail
  // Legacy data URIs are discarded in favour of the canonical URL.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
