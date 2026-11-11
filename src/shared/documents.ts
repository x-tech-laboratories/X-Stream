// The documents X-Stream keeps, each a JSON object under an id whose prefix says what it is, such as `sub-<channel>`.
// The calls are the part of PouchDB's the app used before its data moved into SQLite in the main process.

export interface StoredDocument {
  _id: string
  _rev?: string
}

export type Saved<Document> = Document & { _id: string, _rev: string }

export interface PutResult {
  ok: true
  id: string
  rev: string
}

// Ids from startkey to endkey, inclusive; the app's prefixes end their range with a high character such as '￿'.
export interface AllDocsOptions {
  startkey: string
  endkey: string
  include_docs?: boolean
}

export interface AllDocsRow<Document> {
  id: string
  key: string
  value: { rev: string }
  doc?: Saved<Document>
}

export interface AllDocsResult<Document> {
  rows: AllDocsRow<Document>[]
}

// Ids naming documents that are only copies of YouTube's data, kept apart so backups hold only the user's own.
export const CACHED_PREFIXES = ['metadata-', 'channelcache-']

export function is_cached(id: string): boolean {
  return CACHED_PREFIXES.some((prefix) => id.startsWith(prefix))
}

// A write naming an older revision than the stored one, as PouchDB's conflict was.
export class ConflictError extends Error {
  readonly status = 409
  constructor(id: string) {
    super(`Document update conflict: ${id}`)
  }
}

export class NotFoundError extends Error {
  readonly status = 404
  constructor(id: string) {
    super(`Missing document: ${id}`)
  }
}

// The calls on the page's side, each answered by the main process.
export interface DocumentStore {
  get<Document>(id: string): Promise<Saved<Document>>
  put<Document>(document: Document & StoredDocument): Promise<PutResult>
  remove(document: StoredDocument): Promise<PutResult>
  remove(id: string, rev: string): Promise<PutResult>
  allDocs<Document>(options: AllDocsOptions): Promise<AllDocsResult<Document>>
  bulkDocs<Document>(documents: (Document & StoredDocument)[]): Promise<PutResult[]>
}
