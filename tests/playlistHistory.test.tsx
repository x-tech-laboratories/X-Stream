import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialogs } from '@x-tech-laboratories/x-libs/web/react/dialog'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { open_playlist_changes, open_playlist_history } from '../src/components/PlaylistHistory/PlaylistHistory'

function version(id: string, kind: string, title: string, changed_at: string) {
  return { id, item_id: 'playlist-p1', kind, origin: 'here', restored_from: null, changed_at, previous: null, snapshot: { _id: 'playlist-p1', type: 'playlist', playlistId: 'p1', title, videos: [], createdAt: '', updatedAt: '' } }
}

function device(versions: ReturnType<typeof version>[]) {
  const calls = {
    list_versions: vi.fn(async () => versions),
    list_recent_versions: vi.fn(async () => versions),
    restore_version: vi.fn(async () => {}),
  }
  window.x_stream_device = calls as never
  return calls
}

afterEach(() => {
  cleanup()
  delete window.x_stream_device
})

describe('playlist history', () => {
  it('restores an older version of a playlist, but not the one it is now', async () => {
    const calls = device([version('v2', 'edited', 'Better mix', '2026-11-02T00:00:00Z'), version('v1', 'created', 'Mix', '2026-11-01T00:00:00Z')])
    render(<Dialogs />)
    act(() => open_playlist_history('p1', 'Better mix'))

    expect(await screen.findByText('Mix · 0 videos')).toBeInTheDocument()
    expect(calls.list_versions).toHaveBeenCalledWith('playlist-p1')
    const restores = screen.getAllByRole('button', { name: 'Restore' })
    expect(restores).toHaveLength(1)

    await userEvent.click(restores[0])
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Restore Mix?' })).getByRole('button', { name: 'Restore' }))
    expect(calls.restore_version).toHaveBeenCalledWith('v1')
  })

  it('brings back a deleted playlist from the latest changes', async () => {
    const calls = device([version('v3', 'deleted', 'Gone', '2026-11-03T00:00:00Z')])
    render(<Dialogs />)
    act(() => open_playlist_changes())

    await userEvent.click(await screen.findByRole('button', { name: 'Bring back' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Bring back Gone?' })).getByRole('button', { name: 'Bring back' }))
    expect(calls.restore_version).toHaveBeenCalledWith('v3')
  })
})
