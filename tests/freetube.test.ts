// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { freetube_read_data, freetube_scan, parse_database } from '../src/main/freetube'

function data_folder(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), 'x-stream-freetube-'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(folder, name), text)
  return folder
}

describe('FreeTube import', () => {
  it('reads both a JSON array and one object per line', () => {
    expect(parse_database('[{"a":1},{"a":2}]')).toHaveLength(2)
    expect(parse_database('{"a":1}\n{"a":2}\n')).toHaveLength(2)
    expect(parse_database('{"a":1}')).toHaveLength(1)
  })

  it('finds the data folders that hold a profiles file', () => {
    const home = mkdtempSync(join(tmpdir(), 'x-stream-home-'))
    mkdirSync(join(home, '.config', 'FreeTube'), { recursive: true })
    writeFileSync(join(home, '.config', 'FreeTube', 'profiles.db'), '')
    mkdirSync(join(home, 'snap', 'freetube', 'current', '.config', 'FreeTube'), { recursive: true })

    expect(freetube_scan(home)).toEqual([join(home, '.config', 'FreeTube')])
  })

  it('reads subscriptions once each, across profiles', () => {
    const folder = data_folder({
      'profiles.db': [
        JSON.stringify({ subscriptions: [{ id: 'UC1', name: 'One', thumbnail: 'https://yt3.ggpht.com/1' }, { id: 'UC2', name: 'Two' }] }),
        JSON.stringify({ subscriptions: [{ id: 'UC1', name: 'One again' }, { id: 'UC3' }] }),
      ].join('\n'),
    })

    expect(freetube_read_data(folder).subscriptions).toEqual([
      { id: 'UC1', name: 'One', thumbnail: 'https://yt3.ggpht.com/1' },
      { id: 'UC2', name: 'Two', thumbnail: '' },
    ])
  })

  it('reads history with a default thumbnail and the watch time as a UTC stamp', () => {
    const now = new Date('2026-11-07T12:00:00.000Z')
    const folder = data_folder({
      'history.db': [
        JSON.stringify({ videoId: 'abc', title: 'A', authorId: 'UC1', author: 'One', lengthSeconds: 61, timeWatched: 1_609_459_200_000 }),
        JSON.stringify({ id: 'def', videoThumbnails: [{ url: 'https://i.ytimg.com/x.jpg' }] }),
        JSON.stringify({ title: 'no id' }),
      ].join('\n'),
    })

    expect(freetube_read_data(folder, now).history).toEqual([
      { videoId: 'abc', title: 'A', channelId: 'UC1', channelName: 'One', thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg', duration: 61, watchedAt: '2021-01-01T00:00:00.000Z' },
      { videoId: 'def', title: '', channelId: '', channelName: '', thumbnail: 'https://i.ytimg.com/x.jpg', duration: 0, watchedAt: '2026-11-07T12:00:00.000Z' },
    ])
  })

  it('reads nothing from a folder without FreeTube files', () => {
    expect(freetube_read_data(data_folder({}))).toEqual({ subscriptions: [], history: [] })
  })
})
