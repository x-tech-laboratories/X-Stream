import { describe, it, expect, vi, beforeEach } from 'vitest'
import { memory_store } from './memory_store.ts'

const { store, clear } = memory_store()
vi.mock('../src/db/client', () => ({ db: () => store }))

const {
  getSettings, saveSettings, getSubscriptions, isSubscribed, subscribe, unsubscribe,
  recordWatch, getHistory, getWatchedVideoIds, removeFromHistory, clearHistory,
} = await import('../src/db/index')

// ─── Settings tests ───────────────────────────────────────────────────────────

describe('settings db', () => {
  beforeEach(() => clear())

  it('returns default settings on first read', async () => {
    const s = await getSettings()
    expect(s.theme).toBe('system')
    expect(s.privacyMode).toBe(true)
  })

  it('saves and retrieves theme preference', async () => {
    await saveSettings({ theme: 'dark' })
    expect((await getSettings()).theme).toBe('dark')
  })

  it('partial save does not overwrite unrelated fields', async () => {
    await saveSettings({ theme: 'dark' })
    await saveSettings({ defaultQuality: '720p' })
    const s = await getSettings()
    expect(s.theme).toBe('dark')
    expect(s.defaultQuality).toBe('720p')
    expect(s.privacyMode).toBe(true)
  })

  it('save is idempotent — updates existing doc without conflict', async () => {
    await saveSettings({ theme: 'light' })
    await saveSettings({ theme: 'dark' })
    expect((await getSettings()).theme).toBe('dark')
  })
})

// ─── Subscription tests ───────────────────────────────────────────────────────

describe('subscriptions db', () => {
  beforeEach(() => clear())

  it('returns empty list when no subscriptions', async () => {
    expect(await getSubscriptions()).toEqual([])
  })

  it('isSubscribed returns false for unknown channel', async () => {
    expect(await isSubscribed('UCxxx')).toBe(false)
  })

  it('subscribe stores the channel', async () => {
    await subscribe('UCabc', 'Test Channel')
    const subs = await getSubscriptions()
    expect(subs).toHaveLength(1)
    expect(subs[0].channelId).toBe('UCabc')
    expect(subs[0].channelName).toBe('Test Channel')
  })

  it('isSubscribed returns true after subscribing', async () => {
    await subscribe('UCabc', 'Test Channel')
    expect(await isSubscribed('UCabc')).toBe(true)
  })

  it('subscribe twice does not create duplicate (idempotent)', async () => {
    await subscribe('UCabc', 'Test Channel')
    await subscribe('UCabc', 'Test Channel Updated')
    const subs = await getSubscriptions()
    expect(subs).toHaveLength(1)
    expect(subs[0].channelName).toBe('Test Channel Updated')
  })

  it('unsubscribe removes the channel', async () => {
    await subscribe('UCabc', 'Test Channel')
    await unsubscribe('UCabc')
    expect(await getSubscriptions()).toHaveLength(0)
    expect(await isSubscribed('UCabc')).toBe(false)
  })

  it('unsubscribe on non-existent channel does not throw', async () => {
    await expect(unsubscribe('UCnope')).resolves.not.toThrow()
  })

  it('can manage multiple subscriptions independently', async () => {
    await subscribe('UC1', 'Channel One')
    await subscribe('UC2', 'Channel Two')
    await subscribe('UC3', 'Channel Three')
    await unsubscribe('UC2')
    const subs = await getSubscriptions()
    expect(subs).toHaveLength(2)
    expect(subs.map(s => s.channelId)).not.toContain('UC2')
  })
})

// ─── Watch History tests ──────────────────────────────────────────────────────

describe('watch history db', () => {
  beforeEach(() => clear())

  const rec = (videoId: string, title = 'Title') =>
    recordWatch(videoId, title, 'UC1', 'Chan', '', 120)

  it('returns empty history on first read', async () => {
    expect(await getHistory()).toEqual([])
  })

  it('getWatchedVideoIds returns empty set initially', async () => {
    const ids = await getWatchedVideoIds()
    expect(ids.size).toBe(0)
  })

  it('records a watched video', async () => {
    await rec('vid1', 'My Video')
    const history = await getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].videoId).toBe('vid1')
    expect(history[0].title).toBe('My Video')
    expect(history[0].watchCount).toBe(1)
  })

  it('increments watchCount on re-watch', async () => {
    await rec('vid1')
    await rec('vid1')
    await rec('vid1')
    const history = await getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].watchCount).toBe(3)
  })

  it('getWatchedVideoIds includes recorded video', async () => {
    await rec('vid1')
    const ids = await getWatchedVideoIds()
    expect(ids.has('vid1')).toBe(true)
  })

  it('getWatchedVideoIds excludes unrecorded video', async () => {
    await rec('vid1')
    const ids = await getWatchedVideoIds()
    expect(ids.has('vid2')).toBe(false)
  })

  it('removeFromHistory deletes a single entry', async () => {
    await rec('vid1')
    await rec('vid2')
    await removeFromHistory('vid1')
    const history = await getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].videoId).toBe('vid2')
  })

  it('removeFromHistory on missing entry does not throw', async () => {
    await expect(removeFromHistory('nope')).resolves.not.toThrow()
  })

  it('clearHistory removes all entries', async () => {
    await rec('vid1')
    await rec('vid2')
    await rec('vid3')
    await clearHistory()
    expect(await getHistory()).toHaveLength(0)
    expect((await getWatchedVideoIds()).size).toBe(0)
  })

  it('history is sorted newest first', async () => {
    await rec('vid1')
    await new Promise(r => setTimeout(r, 5))
    await rec('vid2')
    const history = await getHistory()
    expect(history[0].videoId).toBe('vid2')
    expect(history[1].videoId).toBe('vid1')
  })
})
