import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'

vi.mock('../src/db/index', () => ({
  getSubscriptions: vi.fn().mockResolvedValue([]),
  subscribe: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({ theme: 'system' }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/metadata', () => ({
  getChannelInfoCached: vi.fn().mockResolvedValue({}),
}))
vi.mock('../src/utils/avatar', () => ({ downloadAvatar: vi.fn() }))

const Layout = (await import('../src/components/Layout/Layout')).default

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/tall']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="tall" element={<Link to="/short">go short</Link>} />
          <Route path="short" element={<p>short page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('scroll reset on navigation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // The page scrolls with the window, and a short next page would otherwise open scrolled past its content.
  it('scrolls back to the top when the route changes', async () => {
    renderApp()
    vi.mocked(window.scrollTo).mockClear()

    await userEvent.click(screen.getByText('go short'))

    await waitFor(() => expect(screen.getByText('short page')).toBeInTheDocument())
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('moves focus to the page so a screen reader hears the change', async () => {
    renderApp()
    await userEvent.click(screen.getByText('go short'))

    await waitFor(() => expect(document.activeElement?.id).toBe('main'))
  })
})
