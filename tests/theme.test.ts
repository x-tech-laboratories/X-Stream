import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/db/index', () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}))

import { getSettings, saveSettings } from '../src/db/index'
import { load_saved_theme, theme } from '../src/theme'

function settings_with(chosen: 'light' | 'dark' | 'system') {
  return { _id: 'settings', type: 'settings', theme: chosen, activePlugin: 'youtubejs', defaultQuality: 'best', privacyMode: true } as Awaited<ReturnType<typeof getSettings>>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.mocked(saveSettings).mockClear()
})

describe('theme', () => {
  it('follows the system until one is chosen', () => {
    expect(theme.get()).toBe('system')
  })

  it('keeps a choice in the settings and in this browser, and sets it on the page', () => {
    theme.set('dark')

    expect(saveSettings).toHaveBeenCalledWith({ theme: 'dark' })
    expect(localStorage.getItem('x-stream-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('takes the saved settings over this browser on startup', async () => {
    localStorage.setItem('x-stream-theme', 'dark')
    vi.mocked(getSettings).mockResolvedValue(settings_with('light'))

    await load_saved_theme()

    expect(theme.get()).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('keeps this browser\'s copy when the settings cannot be read', async () => {
    localStorage.setItem('x-stream-theme', 'dark')
    vi.mocked(getSettings).mockRejectedValue(new Error('db down'))

    await load_saved_theme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
