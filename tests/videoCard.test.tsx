import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ContextMenus } from '@x-tech-laboratories/x-libs/web/react/menus'
import { Dialogs } from '@x-tech-laboratories/x-libs/web/react/dialog'
import { Toasts } from '@x-tech-laboratories/x-libs/web/react/toasts'

const recordWatch = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/db/index', () => ({ recordWatch }))
const addToPlaylist = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/db/playlists', () => ({
  getPlaylists: vi.fn().mockResolvedValue([
    { playlistId: 'p1', title: 'Favourites', videos: [{ videoId: 'abc' }] },
    { playlistId: 'p2', title: 'Later', videos: [] },
  ]),
  addToPlaylist,
  createPlaylist: vi.fn(),
}))
const openInBrowser = vi.fn()
vi.mock('../src/utils/desktop', () => ({ openInBrowser }))

const VideoCard = (await import('../src/components/VideoCard/VideoCard')).default

function renderCard(props: Partial<Parameters<typeof VideoCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <div role="list">
        <VideoCard videoId="abc" title="Cool Video" channelId="UC1" channelName="Cool Channel" duration={187} viewCountText="1.4M views" publishedText="2 weeks ago" {...props} />
      </div>
      <ContextMenus />
      <Dialogs />
      <Toasts />
    </MemoryRouter>,
  )
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Options for Cool Video' }))
}

describe('VideoCard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows the length, the channel and the stats', () => {
    renderCard()
    expect(screen.getByText('3:07')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cool Channel' })).toHaveAttribute('href', '/channel/UC1')
    expect(screen.getByText('1.4M views · 2 weeks ago')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cool Video' })).toHaveAttribute('href', '#/watch/abc')
  })

  it('offers the video actions in its menu', async () => {
    renderCard()
    await openMenu()
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Mark as watched', 'Open in YouTube', 'Copy link', 'Add to playlist'])
  })

  it('marks the video watched and says so', async () => {
    const onMarkWatched = vi.fn()
    renderCard({ onMarkWatched })
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark as watched' }))

    expect(recordWatch).toHaveBeenCalledWith('abc', 'Cool Video', 'UC1', 'Cool Channel', '', 187)
    expect(await screen.findByText('Marked as watched.')).toBeInTheDocument()
    expect(onMarkWatched).toHaveBeenCalled()
  })

  it('opens the video in the browser', async () => {
    renderCard()
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open in YouTube' }))
    expect(openInBrowser).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc')
  })

  it('adds the video to a playlist from the picker', async () => {
    renderCard()
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add to playlist' }))

    expect(await screen.findByRole('button', { name: /Favourites/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Later/ }))
    await waitFor(() => expect(addToPlaylist).toHaveBeenCalledWith('p2', expect.objectContaining({ videoId: 'abc', title: 'Cool Video' })))
  })

  it('offers a remove button when the list allows it', async () => {
    const onRemove = vi.fn()
    renderCard({ onRemove, removeLabel: 'Remove Cool Video from history' })
    await userEvent.click(screen.getByRole('button', { name: 'Remove Cool Video from history' }))
    expect(onRemove).toHaveBeenCalled()
  })
})
