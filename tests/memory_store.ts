// The desktop app's document tables on in-memory SQLite, for tests that put them in place of src/db/client.

import { DatabaseSync } from 'node:sqlite'

import { document_table, install_documents, routed_documents } from '../src/main/documents.ts'
import { install_playlist_history, playlist_history } from '../src/main/playlist_history.ts'
import type { DocumentStore, StoredDocument } from '../src/shared/documents.ts'

export function memory_store() {
  const user = new DatabaseSync(':memory:')
  install_documents(user)
  install_playlist_history(user)
  const cache = new DatabaseSync(':memory:')
  install_documents(cache)
  const routed = routed_documents(document_table(() => user, { after_write: (database) => playlist_history.record(database) }), document_table(() => cache))

  const store = {
    get: async (id: string) => {
      const document = routed.documents_get(id)
      if (!document) throw new Error(`Missing document: ${id}`)
      return document
    },
    put: async (document: StoredDocument) => routed.documents_put(document),
    remove: async (document_or_id: StoredDocument | string, rev?: string) =>
      typeof document_or_id === 'string' ? routed.documents_remove(document_or_id, rev) : routed.documents_remove(document_or_id._id, document_or_id._rev),
    allDocs: async (options: Parameters<typeof routed.documents_all>[0]) => routed.documents_all(options),
    bulkDocs: async (documents: StoredDocument[]) => routed.documents_bulk(documents),
  } as DocumentStore

  return {
    store,
    user,
    clear: () => {
      for (const database of [user, cache]) database.exec('DELETE FROM documents')
      user.exec('DELETE FROM playlist_versions; DELETE FROM playlist_versions_pending')
    },
  }
}
