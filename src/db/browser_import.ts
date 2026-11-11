// Brings over, once, the documents the page kept in its own browser storage before they moved into the desktop app's
// database. The old copy is left where it was.

import PouchDB from 'pouchdb-browser'

import { desktop_api } from '../utils/desktop'

export async function import_browser_storage(): Promise<void> {
  if (!(await desktop_api().documents_need_import())) return
  const old = new PouchDB('x-stream')
  try {
    const all = await old.allDocs({ include_docs: true })
    const documents = all.rows.flatMap((row) => (row.doc && !row.id.startsWith('_design/') ? [row.doc] : []))
    await desktop_api().documents_import(documents)
  } finally {
    await old.close()
  }
}
