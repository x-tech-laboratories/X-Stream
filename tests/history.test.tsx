import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dialogs } from '@x-tech-laboratories/x-libs/web/react/dialog'

const entry = {
  _id: 'history-abc', type: 'history', videoId: 'abc', title: 'Cool Video', channelId: 'UC1', channelName: 'Cool Channel',
  thumbnail: '', duration: 120, watchedAt: new Date().toISOString(), watchCount: 3,
}
const getHistory = vi.fn()
const clearHistory = vi.fn().mockResolvedValue(undefined)
const removeFromHistory = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/db/index', () => ({ getHistory, clearHistory, removeFromHistory, recordWatch: vi.fn() }))

const History = (await import('../src/pages/History/History')).default

function renderHistory() {
  return render(<MemoryRouter><History /><Dialogs /></MemoryRouter>)
}

describe('History page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    getHistory.mockResolvedValue([entry])
  })

  it('lists watched videos with how often each was watched', async () => {
    renderHistory()
    expect(await screen.findByText('Cool Video')).toBeInTheDocument()
    expect(screen.getByText('3×')).toBeInTheDocument()
  })

  it('says so when nothing has been watched', async () => {
    getHistory.mockResolvedValue([])
    renderHistory()
    expect(await screen.findByText('No watch history yet.')).toBeInTheDocument()
  })

  it('removes one video', async () => {
    renderHistory()
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Cool Video from history' }))

    expect(removeFromHistory).toHaveBeenCalledWith('abc')
    await waitFor(() => expect(screen.queryByText('Cool Video')).not.toBeInTheDocument())
  })

  it('asks before clearing everything', async () => {
    renderHistory()
    await userEvent.click(await screen.findByRole('button', { name: 'Clear all' }))
    expect(clearHistory).not.toHaveBeenCalled()

    getHistory.mockResolvedValue([])
    await userEvent.click(screen.getByRole('button', { name: 'Clear history' }))

    expect(clearHistory).toHaveBeenCalled()
    expect(await screen.findByText('No watch history yet.')).toBeInTheDocument()
  })
})
