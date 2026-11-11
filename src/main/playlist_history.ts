// The history of the user's own playlists: every change is a version, any of which can be restored, and a deleted
// playlist can be brought back. Subscribed playlists are YouTube's, and the watch history is a log, so neither is kept.

import { create_history } from '@x-tech-laboratories/x-libs/history'
import type { SqlDatabase } from '@x-tech-laboratories/x-libs/sql'

import type { PlaylistSnapshot } from '../shared/bridge.ts'

const PERSONAL = "'playlist-%'"

function read(database: SqlDatabase, id: string): PlaylistSnapshot | null {
  const row = database.prepare('SELECT body FROM documents WHERE id = ?').get(id) as { body: string } | undefined
  return row ? { ...(JSON.parse(row.body) as Omit<PlaylistSnapshot, '_id'>), _id: id } : null
}

function apply(database: SqlDatabase, id: string, snapshot: PlaylistSnapshot): void {
  const { _id, ...body } = snapshot
  database.prepare('INSERT INTO documents (id, rev, body) VALUES (?, 1, ?) ON CONFLICT (id) DO UPDATE SET rev = rev + 1, body = excluded.body').run(id, JSON.stringify(body))
}

export const playlist_history = create_history<PlaylistSnapshot>({
  name: 'playlist',
  item_table: 'personal_playlists',
  // Every document shares the one table, so only a personal playlist's writes are noted.
  watches: [{ table: 'documents', item_lookup: (row) => `SELECT ${row}.id WHERE ${row}.id LIKE ${PERSONAL}` }],
  read,
  apply,
  created_at: (snapshot) => snapshot.createdAt,
})

// Makes the view the history reads its items from, then its own tables and triggers.
export function install_playlist_history(database: SqlDatabase): void {
  database.exec(`CREATE VIEW IF NOT EXISTS personal_playlists AS SELECT id FROM documents WHERE id LIKE ${PERSONAL}`)
  playlist_history.install(database)
}

// Versions older than this many days go, each playlist keeping its newest.
export const DEFAULT_HISTORY_DAYS = 90

export function prune_playlist_history(database: SqlDatabase, days: number): void {
  playlist_history.prune(database, new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
}
