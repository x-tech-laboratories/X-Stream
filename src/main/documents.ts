// The documents table in an SQLite database, answering the page's document calls: each document's JSON under its id,
// with a revision counted up on every write so a write from an older copy is refused, as PouchDB refused it.

import { in_transaction, migrate, type SqlDatabase } from '@x-tech-laboratories/x-libs/sql'

import { ConflictError, is_cached, NotFoundError, type AllDocsOptions, type AllDocsResult, type PutResult, type Saved, type StoredDocument } from '../shared/documents.ts'

// ============================================================================
// Schema
// ============================================================================

const steps = [
  `CREATE TABLE documents (id TEXT PRIMARY KEY, rev INTEGER NOT NULL, body TEXT NOT NULL) WITHOUT ROWID;
   CREATE TABLE store_state (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID`,
]

export function install_documents(database: SqlDatabase): void {
  migrate(database, steps)
}

// Whether opening the database would change its tables, so the app backs it up first.
export function documents_need_upgrade(database: SqlDatabase): boolean {
  const { user_version } = database.prepare('PRAGMA user_version').get() as { user_version: number }
  return user_version > 0 && user_version < steps.length
}

// ============================================================================
// Table
// ============================================================================

interface Row {
  id: string
  rev: number
  body: string
}

function saved<Document>(row: Row): Saved<Document> {
  return { ...(JSON.parse(row.body) as Document), _id: row.id, _rev: String(row.rev) }
}

// The document's own fields; the id and revision are columns of their own.
function body_of(document: StoredDocument): string {
  const { _id, _rev, ...body } = document as StoredDocument & Record<string, unknown>
  return JSON.stringify(body)
}

export interface DocumentTableOptions {
  // Run after every write, such as the history noting the playlists it touched.
  after_write?: (database: SqlDatabase) => void
}

export type DocumentTable = ReturnType<typeof document_table>

export function document_table(database: () => SqlDatabase, options: DocumentTableOptions = {}) {
  function read(id: string): Row | undefined {
    return database().prepare('SELECT id, rev, body FROM documents WHERE id = ?').get(id) as Row | undefined
  }

  function write(document: StoredDocument): PutResult {
    const current = read(document._id)
    if (current && document._rev !== String(current.rev)) throw new ConflictError(document._id)
    const rev = (current?.rev ?? 0) + 1
    database().prepare('INSERT INTO documents (id, rev, body) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET rev = excluded.rev, body = excluded.body').run(document._id, rev, body_of(document))
    return { ok: true, id: document._id, rev: String(rev) }
  }

  function erase(id: string, rev: string | undefined): PutResult {
    const current = read(id)
    if (!current) throw new NotFoundError(id)
    if (rev !== String(current.rev)) throw new ConflictError(id)
    database().prepare('DELETE FROM documents WHERE id = ?').run(id)
    return { ok: true, id, rev: String(current.rev + 1) }
  }

  function written<Result>(work: () => Result): Result {
    return in_transaction(database(), () => {
      const result = work()
      options.after_write?.(database())
      return result
    })
  }

  return {
    get<Document>(id: string): Saved<Document> {
      const row = read(id)
      if (!row) throw new NotFoundError(id)
      return saved<Document>(row)
    },

    find<Document>(id: string): Saved<Document> | null {
      const row = read(id)
      return row ? saved<Document>(row) : null
    },

    put(document: StoredDocument): PutResult {
      return written(() => write(document))
    },

    remove(id: string, rev: string | undefined): PutResult {
      return written(() => erase(id, rev))
    },

    all<Document>({ startkey, endkey, include_docs }: AllDocsOptions): AllDocsResult<Document> {
      const rows = database().prepare(`SELECT id, rev${include_docs ? ', body' : ''} FROM documents WHERE id >= ? AND id <= ? ORDER BY id`).all(startkey, endkey) as unknown as Row[]
      return {
        rows: rows.map((row) => ({ id: row.id, key: row.id, value: { rev: String(row.rev) }, ...(include_docs ? { doc: saved<Document>(row) } : {}) })),
      }
    },

    bulk(documents: StoredDocument[]): PutResult[] {
      return written(() => documents.map(write))
    },

    // Takes documents as they are, keeping none of their revisions, such as the copy the page kept before.
    load(documents: StoredDocument[]): number {
      return written(() => {
        for (const document of documents) database().prepare('INSERT OR REPLACE INTO documents (id, rev, body) VALUES (?, 1, ?)').run(document._id, body_of(document))
        return documents.length
      })
    },

    state(key: string): string | undefined {
      return (database().prepare('SELECT value FROM store_state WHERE key = ?').get(key) as { value: string } | undefined)?.value
    },

    set_state(key: string, value: string): void {
      database().prepare('INSERT OR REPLACE INTO store_state (key, value) VALUES (?, ?)').run(key, value)
    },
  }
}

// ============================================================================
// User data and cache
// ============================================================================

// The user's documents in one table and YouTube's cached ones in another, each call sent by its ids' prefix.
export function routed_documents(user: DocumentTable, cache: DocumentTable) {
  const table_for = (id: string) => (is_cached(id) ? cache : user)
  return {
    documents_get: (id: string) => table_for(id).find(id),
    documents_put: (document: StoredDocument) => table_for(document._id).put(document),
    documents_remove: (id: string, rev: string | undefined) => table_for(id).remove(id, rev),
    documents_all: (options: AllDocsOptions) => table_for(options.startkey).all(options),
    documents_bulk: (documents: StoredDocument[]) => {
      const cached = documents.filter((document) => is_cached(document._id))
      const own = documents.filter((document) => !is_cached(document._id))
      const results = new Map([...user.bulk(own), ...cache.bulk(cached)].map((result) => [result.id, result]))
      return documents.map((document) => results.get(document._id)!)
    },
  }
}
