// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, describe, expect, it } from 'vitest'

import { open_store } from '../src/main/store.ts'

let close: (() => void) | null = null

afterEach(() => {
  close?.()
  close = null
})

async function opened() {
  const folder = mkdtempSync(join(tmpdir(), 'x-stream-store-'))
  const store = await open_store(folder)
  close = store.close
  return { folder, ...store }
}

function playlist(title: string) {
  return { _id: 'playlist-p1', type: 'playlist', playlistId: 'p1', title, videos: [], createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }
}

describe('the desktop store', () => {
  it('keeps the user\'s documents in x-stream.db and YouTube\'s copies in cache.db', async () => {
    const { folder, methods } = await opened()
    methods.documents_put({ _id: 'sub-UC1', type: 'subscription', channelName: 'One' } as never)
    methods.documents_put({ _id: 'metadata-video-v1', type: 'metadata' } as never)

    expect(methods.documents_get('sub-UC1')).toMatchObject({ channelName: 'One', _rev: '1' })
    expect(methods.documents_get('sub-UC2')).toBeNull()
    const ids = (path: string) => (new DatabaseSync(path).prepare('SELECT id FROM documents').all() as { id: string }[]).map((row) => row.id)
    expect(ids(join(folder, 'x-stream.db'))).toEqual(['sub-UC1'])
    expect(ids(join(folder, 'cache.db'))).toEqual(['metadata-video-v1'])
  })

  it('refuses a write from an older copy, as PouchDB did', async () => {
    const { methods } = await opened()
    const first = methods.documents_put({ _id: 'settings', theme: 'dark' } as never)
    methods.documents_put({ _id: 'settings', _rev: first.rev, theme: 'light' } as never)
    expect(() => methods.documents_put({ _id: 'settings', _rev: first.rev, theme: 'system' } as never)).toThrow(/conflict/)
    expect(() => methods.documents_put({ _id: 'settings', theme: 'system' } as never)).toThrow(/conflict/)
  })

  it('brings the page\'s old browser copy over once', async () => {
    const { methods } = await opened()
    expect(methods.documents_need_import()).toBe(true)
    expect(methods.documents_import([{ _id: 'history-v1', _rev: '7-abc', title: 'Old' }, { _id: 'channelcache-UC1', _rev: '2-def' }] as never)).toBe(2)
    expect(methods.documents_need_import()).toBe(false)
    expect(methods.documents_import([{ _id: 'history-v2' }] as never)).toBe(0)
    expect(methods.documents_get('history-v1')).toMatchObject({ title: 'Old', _rev: '1' })
  })

  it('backs up and restores the user\'s data', async () => {
    const { methods, device_methods } = await opened()
    methods.documents_put({ _id: 'sub-UC1', channelName: 'One' } as never)
    const backup = await device_methods.create_backup()
    methods.documents_remove('sub-UC1', '1')

    await device_methods.restore_backup(backup.name)

    expect(methods.documents_get('sub-UC1')).toMatchObject({ channelName: 'One' })
    // The restore backed up what it replaced first, beside the backup taken on opening and the one restored.
    expect(await device_methods.list_backups()).toHaveLength(3)
  })

  it('keeps every version of a personal playlist and brings a deleted one back', async () => {
    const { methods, device_methods } = await opened()
    const made = methods.documents_put(playlist('Mix') as never)
    methods.documents_put({ ...playlist('Better mix'), _rev: made.rev } as never)
    methods.documents_put({ _id: 'playlistsub-PL1', type: 'playlist-sub', title: 'Theirs' } as never)
    methods.documents_remove('playlist-p1', '2')

    const versions = device_methods.list_versions('playlist-p1')
    expect(versions.map((version) => [version.kind, version.snapshot.title])).toEqual([['deleted', 'Better mix'], ['edited', 'Better mix'], ['created', 'Mix']])
    expect(device_methods.list_versions('playlistsub-PL1')).toEqual([])

    device_methods.restore_version(versions[0].id)
    expect(methods.documents_get('playlist-p1')).toMatchObject({ title: 'Better mix' })
  })
})
