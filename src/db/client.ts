// The page's documents, kept in SQLite by the desktop app's main process and reached through its bridge. Tests put a
// store of their own in its place by mocking this module.

import { NotFoundError, type AllDocsOptions, type AllDocsResult, type DocumentStore, type PutResult, type Saved, type StoredDocument } from '../shared/documents.ts'
import { desktop_api } from '../utils/desktop'

function remove(document: StoredDocument): Promise<PutResult>
function remove(id: string, rev: string): Promise<PutResult>
function remove(document_or_id: StoredDocument | string, rev?: string): Promise<PutResult> {
  return typeof document_or_id === 'string'
    ? desktop_api().documents_remove(document_or_id, rev)
    : desktop_api().documents_remove(document_or_id._id, document_or_id._rev)
}

const bridge_store: DocumentStore = {
  get: async <Document>(id: string) => {
    const document = await desktop_api().documents_get(id)
    if (!document) throw new NotFoundError(id)
    return document as Saved<Document>
  },
  put: (document) => desktop_api().documents_put(document),
  remove,
  allDocs: <Document>(options: AllDocsOptions) => desktop_api().documents_all(options) as Promise<AllDocsResult<Document>>,
  bulkDocs: (documents) => desktop_api().documents_bulk(documents),
}

export function db(): DocumentStore {
  return bridge_store
}
