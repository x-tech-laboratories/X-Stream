// Finds FreeTube's data on this machine and reads its subscriptions and watch history.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { FreetubeData, FreetubeHistoryEntry, FreetubeSubscription } from '../shared/bridge.ts'

type Row = Record<string, unknown>

// ============================================================================
// Database files
// ============================================================================

// Older FreeTube releases write one JSON object per line, newer ones a single array.
export function parse_database(raw: string): Row[] {
  const trimmed = raw.trim()
  try {
    const value: unknown = JSON.parse(trimmed)
    return Array.isArray(value) ? value as Row[] : [value as Row]
  } catch {
    return trimmed.split('\n').filter((line) => line.trim() !== '').flatMap((line) => {
      try {
        return [JSON.parse(line) as Row]
      } catch {
        return []
      }
    })
  }
}

function read_database(directory: string, file_name: string): Row[] {
  try {
    return parse_database(readFileSync(join(directory, file_name), 'utf8'))
  } catch {
    return []
  }
}

function text_field(row: Row, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

// ============================================================================
// Data folders
// ============================================================================

export function candidate_directories(home_directory = homedir()): string[] {
  return [
    join(home_directory, '.config', 'FreeTube'),
    join(home_directory, '.var', 'app', 'io.freetubeapp.FreeTube', 'config', 'FreeTube'),
    join(home_directory, 'snap', 'freetube', 'current', '.config', 'FreeTube'),
    join(home_directory, 'AppData', 'Roaming', 'FreeTube'),
    join(home_directory, 'Library', 'Application Support', 'FreeTube'),
  ]
}

export function freetube_scan(home_directory = homedir()): string[] {
  return candidate_directories(home_directory).filter((directory) => {
    const profiles_file = join(directory, 'profiles.db')
    return existsSync(profiles_file) && statSync(profiles_file).isFile()
  })
}

// ============================================================================
// Subscriptions and history
// ============================================================================

function read_subscriptions(directory: string): FreetubeSubscription[] {
  const seen_ids = new Set<string>()
  const subscriptions: FreetubeSubscription[] = []

  for (const profile of read_database(directory, 'profiles.db')) {
    if (!Array.isArray(profile.subscriptions)) continue
    for (const subscription of profile.subscriptions as Row[]) {
      const id = text_field(subscription, 'id')
      const name = text_field(subscription, 'name')
      if (!id || !name || seen_ids.has(id)) continue
      seen_ids.add(id)
      subscriptions.push({ id, name, thumbnail: text_field(subscription, 'thumbnail') })
    }
  }
  return subscriptions
}

function first_thumbnail(row: Row): string {
  const thumbnails = row.videoThumbnails
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return ''
  return text_field(thumbnails[0] as Row, 'url')
}

// FreeTube keeps the watch time in milliseconds since 1970.
function watched_at(row: Row, now: Date): string {
  const time_watched = row.timeWatched
  if (typeof time_watched === 'number' && Number.isInteger(time_watched) && time_watched >= 0) return new Date(time_watched).toISOString()
  return now.toISOString()
}

function read_history(directory: string, now: Date): FreetubeHistoryEntry[] {
  return read_database(directory, 'history.db').flatMap((row) => {
    const video_id = text_field(row, 'videoId') || text_field(row, 'id')
    if (!video_id) return []
    const length_seconds = row.lengthSeconds
    return [{
      videoId: video_id,
      title: text_field(row, 'title'),
      channelId: text_field(row, 'authorId'),
      channelName: text_field(row, 'author'),
      thumbnail: first_thumbnail(row) || `https://i.ytimg.com/vi/${video_id}/hqdefault.jpg`,
      duration: typeof length_seconds === 'number' && Number.isInteger(length_seconds) ? length_seconds : 0,
      watchedAt: watched_at(row, now),
    }]
  })
}

export function freetube_read_data(directory: string, now = new Date()): FreetubeData {
  return { subscriptions: read_subscriptions(directory), history: read_history(directory, now) }
}
