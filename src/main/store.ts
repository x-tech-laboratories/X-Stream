// X-Stream's data in the profile folder: the user's own documents in x-stream.db, backed up daily beside it with the
// playlists' history inside, and the copies of YouTube's data in cache.db, which backups leave out since it refetches.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { backup_naming, keep_backing_up } from '@x-tech-laboratories/x-libs/backups'
import { history_methods } from '@x-tech-laboratories/x-libs/history'
import type { SqlDatabase } from '@x-tech-laboratories/x-libs/sql'
import { json_backup_schedule } from '@x-tech-laboratories/x-libs/server/backup_routes'
import { sqlite_backups } from '@x-tech-laboratories/x-libs/server/sqlite_backups'

import type { XStreamApi, XStreamDeviceApi } from '../shared/bridge.ts'
import { is_cached, type StoredDocument } from '../shared/documents.ts'
import { document_table, documents_need_upgrade, install_documents, routed_documents } from './documents.ts'
import { DEFAULT_HISTORY_DAYS, install_playlist_history, playlist_history, prune_playlist_history } from './playlist_history.ts'

type DocumentMethods = Pick<XStreamApi, 'documents_get' | 'documents_put' | 'documents_remove' | 'documents_all' | 'documents_bulk' | 'documents_need_import' | 'documents_import'>

// Set once the page's old browser copy has been brought over, or found empty.
const IMPORTED = 'imported_browser_storage'

function open_database(path: string): DatabaseSync {
  const database = new DatabaseSync(path)
  database.exec('PRAGMA journal_mode = WAL')
  return database
}

function history_days(database: SqlDatabase): number {
  const row = database.prepare("SELECT body FROM documents WHERE id = 'settings'").get() as { body: string } | undefined
  const days = row ? (JSON.parse(row.body) as { playlistHistoryDays?: number }).playlistHistoryDays : undefined
  return typeof days === 'number' && days > 0 ? days : DEFAULT_HISTORY_DAYS
}

function install_user(database: SqlDatabase): void {
  install_documents(database)
  install_playlist_history(database)
  prune_playlist_history(database, history_days(database))
}

export async function open_store(folder: string) {
  mkdirSync(folder, { recursive: true })
  const user_path = join(folder, 'x-stream.db')
  let user = open_database(user_path)
  const cache = open_database(join(folder, 'cache.db'))

  const backups_folder = join(folder, 'backups')
  const kept = sqlite_backups({
    folder: () => {
      mkdirSync(backups_folder, { recursive: true })
      return backups_folder
    },
    naming: backup_naming('x-stream', '.db'),
    database: () => user,
    database_path: () => user_path,
    close: () => user.close(),
    open: () => {
      user = open_database(user_path)
      install_user(user)
    },
  })

  if (documents_need_upgrade(user)) await kept.create()
  install_user(user)
  install_documents(cache)

  const user_table = document_table(() => user, { after_write: (database) => playlist_history.record(database) })
  const cache_table = document_table(() => cache)

  const schedule = json_backup_schedule(join(folder, 'backup-schedule.json'))
  const backing_up = keep_backing_up(kept, schedule.get)

  const methods: DocumentMethods = {
    ...routed_documents(user_table, cache_table),
    documents_need_import: () => user_table.state(IMPORTED) === undefined,
    documents_import: (documents: StoredDocument[]) => {
      if (user_table.state(IMPORTED) !== undefined) return 0
      const count = user_table.load(documents.filter((document) => !is_cached(document._id))) + cache_table.load(documents.filter((document) => is_cached(document._id)))
      user_table.set_state(IMPORTED, new Date().toISOString())
      return count
    },
  }

  const device_methods: XStreamDeviceApi = {
    list_backups: kept.list,
    create_backup: () => kept.create(),
    restore_backup: kept.restore,
    remove_backup: kept.remove,
    get_backup_schedule: schedule.get,
    set_backup_schedule: (next) => {
      schedule.set(next)
      void backing_up.check()
    },
    ...history_methods(playlist_history, () => user),
  }

  return {
    methods,
    device_methods,
    close: () => {
      backing_up.stop()
      user.close()
      cache.close()
    },
  }
}
