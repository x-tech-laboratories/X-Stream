import { useEffect, useState } from 'react'
import type { Theme } from '@x-tech-laboratories/x-libs/web/theme'
import { Badge } from '@x-tech-laboratories/x-libs/web/react/badges'
import { NumberField, Segmented } from '@x-tech-laboratories/x-libs/web/react/controls'
import { BackupSettings } from '@x-tech-laboratories/x-libs/web/react/backup_settings'
import { SettingRow, SettingsGroup } from '@x-tech-laboratories/x-libs/web/react/layout'
import { PluginSettings } from '@x-tech-laboratories/x-libs/web/react/plugins'
import { theme } from '../../theme'
import { pluginManager } from '../../plugins/manager'
import { saveSettings, getSettings, subscribe, recordWatch } from '../../db/index'
import { STARTUP_PAGES, type StartupPage } from '../../types'
import { setCookie as ytjsSetCookie } from '../../plugins/youtubejs/innertube'
import { downloadAvatar } from '../../utils/avatar'
import { is_desktop, desktop_device, freetubeScan, freetubeReadData } from '../../utils/desktop'
import PageLayout from '../../components/PageLayout'
import './Settings.css'

// The same default as the main process's, which prunes the history.
const DEFAULT_HISTORY_DAYS = 90

// ============================================================================
// FreeTube import
// ============================================================================

type FtSub = { id: string; name: string; thumbnail: string }
type FtHistEntry = {
  videoId: string; title: string; channelId: string; channelName: string
  thumbnail: string; duration: number; watchedAt: string
}
type FtData = { subscriptions: FtSub[]; history: FtHistEntry[] }

type ImportPhase =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'not-found' }
  | { status: 'preview'; dir: string; data: FtData }
  | { status: 'importing' }
  | { status: 'done'; subs: number; hist: number }
  | { status: 'error'; message: string }

// ============================================================================
// Settings
// ============================================================================

type WatchedStyle = 'normal' | 'dim' | 'hide'

export default function Settings() {
  const [themeChoice, setThemeChoice] = useState<Theme>(theme.get)
  const [watchedStyle, setWatchedStyleState] = useState<WatchedStyle>('normal')
  const [startupPage, setStartupPageState] = useState<StartupPage>('subscriptions')
  const [historyDays, setHistoryDays] = useState(DEFAULT_HISTORY_DAYS)

  const [importState, setImportState] = useState<ImportPhase>({ status: 'idle' })
  const [importSubs, setImportSubs] = useState(true)
  const [importHist, setImportHist] = useState(true)

  const [ytCookieDraft, setYtCookieDraft] = useState('')
  const [ytCookieSaved, setYtCookieSaved] = useState(false)

  useEffect(() => theme.on_change(setThemeChoice), [])

  useEffect(() => {
    getSettings().then(s => {
      setWatchedStyleState(s.watchedVideoStyle ?? 'normal')
      setStartupPageState(s.startupPage ?? 'subscriptions')
      setHistoryDays(s.playlistHistoryDays ?? DEFAULT_HISTORY_DAYS)
      setYtCookieDraft(s.ytCookie ?? '')
      setYtCookieSaved(!!(s.ytCookie))
    }).catch(() => {})
  }, [])

  function handleSaveCookie() {
    const cookie = ytCookieDraft.trim()
    saveSettings({ ytCookie: cookie }).catch(() => {})
    ytjsSetCookie(cookie)
    setYtCookieSaved(!!cookie)
  }

  function handleClearCookie() {
    setYtCookieDraft('')
    saveSettings({ ytCookie: '' }).catch(() => {})
    ytjsSetCookie('')
    setYtCookieSaved(false)
  }

  function handleStartupPageChange(page: StartupPage) {
    setStartupPageState(page)
    saveSettings({ startupPage: page }).catch(() => {})
  }

  function handleHistoryDaysChange(days: number | null) {
    const kept = Math.max(1, Math.round(days ?? DEFAULT_HISTORY_DAYS))
    setHistoryDays(kept)
    saveSettings({ playlistHistoryDays: kept }).catch(() => {})
  }

  function handleWatchedStyleChange(style: WatchedStyle) {
    setWatchedStyleState(style)
    saveSettings({ watchedVideoStyle: style }).catch(() => {})
  }

  async function handleScan() {
    if (!is_desktop()) return
    setImportState({ status: 'scanning' })
    try {
      const dirs = await freetubeScan()
      if (!dirs.length) { setImportState({ status: 'not-found' }); return }
      const dir = dirs[0]
      const data = await freetubeReadData(dir)
      setImportState({ status: 'preview', dir, data })
    } catch (e) {
      setImportState({ status: 'error', message: (e as Error).message })
    }
  }

  async function handleImport() {
    if (importState.status !== 'preview') return
    const { data } = importState
    setImportState({ status: 'importing' })
    let subsImported = 0
    let histImported = 0
    try {
      if (importSubs) {
        for (const sub of data.subscriptions) {
          await subscribe(sub.id, sub.name)
          subsImported++
        }
      }
      if (importHist) {
        for (const entry of data.history) {
          await recordWatch(
            entry.videoId, entry.title, entry.channelId,
            entry.channelName,
            entry.thumbnail || `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
            entry.duration,
          )
          histImported++
        }
      }
      setImportState({ status: 'done', subs: subsImported, hist: histImported })

      if (importSubs && data.subscriptions.length > 0) {
        let plugin
        try { plugin = pluginManager.getActive() } catch { /* no plugin active */ }
        if (plugin) {
          const subs = data.subscriptions
          ;(async () => {
            for (let i = 0; i < subs.length; i++) {
              if (i > 0) await new Promise<void>(r => setTimeout(r, 800))
              const sub = subs[i]
              try {
                const info = await plugin!.getChannelInfo(sub.id)
                if (info.avatar) {
                  const blob = await downloadAvatar(info.avatar)
                  if (blob) await subscribe(sub.id, sub.name, blob)
                }
              } catch { /* skip unreachable channels */ }
            }
          })()
        }
      }
    } catch (e) {
      setImportState({ status: 'error', message: (e as Error).message })
    }
  }

  const isDesktop = is_desktop()

  return (
    <PageLayout title="Settings">
      <SettingsGroup heading="Appearance">
        <SettingRow label="Theme">
          <Segmented<Theme>
            label="Theme"
            choices={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            value={themeChoice}
            on_change={choice => theme.set(choice)}
          />
        </SettingRow>
        <SettingRow label="Previously watched" hint="How videos you have already watched show in lists.">
          <Segmented<WatchedStyle>
            label="Previously watched"
            choices={[{ value: 'normal', label: 'Normal' }, { value: 'dim', label: 'Dim' }, { value: 'hide', label: 'Hide' }]}
            value={watchedStyle}
            on_change={handleWatchedStyleChange}
          />
        </SettingRow>
        <SettingRow label="Startup Page">
          <Segmented<StartupPage>
            label="Startup Page"
            choices={STARTUP_PAGES.map(page => ({ value: page.value, label: page.label }))}
            value={startupPage}
            on_change={handleStartupPageChange}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        heading="YouTube Account"
        hint={<>
          Paste your YouTube session cookie to enable high-quality streams (720p+).
          In a browser signed into YouTube, open DevTools → Network → copy the full
          <code> Cookie:</code> header value from any youtube.com request.
        </>}
      >
        <textarea
          className="yt-cookie-input"
          rows={3}
          placeholder="VISITOR_INFO1_LIVE=...; __Secure-1PSID=..."
          aria-label="YouTube session cookie"
          value={ytCookieDraft}
          onChange={e => setYtCookieDraft(e.target.value)}
          spellCheck={false}
        />
        <div className="toolbar">
          <button type="button" onClick={handleSaveCookie} disabled={ytCookieDraft.trim() === ''}>Save cookie</button>
          {ytCookieSaved && <button type="button" onClick={handleClearCookie}>Clear</button>}
          {ytCookieSaved && <Badge tone="good">Cookie saved</Badge>}
        </div>
      </SettingsGroup>

      <SettingsGroup heading="Import from FreeTube">
        {!isDesktop ? (
          <p className="muted">Available in the desktop app only.</p>
        ) : (
          <div className="stack tight">
            {(importState.status === 'idle' || importState.status === 'not-found') && (
              <>
                <div><button type="button" onClick={handleScan}>Find FreeTube Data</button></div>
                {importState.status === 'not-found' && (
                  <p className="tone-warn">
                    No FreeTube installation found. Install FreeTube or check that it has been run at least once.
                  </p>
                )}
              </>
            )}

            {importState.status === 'scanning' && <p className="muted">Searching for FreeTube data…</p>}

            {importState.status === 'preview' && (
              <>
                <code className="path">{importState.dir}</code>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={importSubs}
                    disabled={!importState.data.subscriptions.length}
                    onChange={e => setImportSubs(e.target.checked)}
                  />
                  Subscriptions <Badge>{importState.data.subscriptions.length}</Badge>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={importHist}
                    disabled={!importState.data.history.length}
                    onChange={e => setImportHist(e.target.checked)}
                  />
                  Watch history <Badge>{importState.data.history.length}</Badge>
                </label>
                <div className="toolbar">
                  <button type="button" className="accent solid" onClick={handleImport} disabled={!importSubs && !importHist}>Import</button>
                  <button type="button" onClick={() => setImportState({ status: 'idle' })}>Cancel</button>
                </div>
              </>
            )}

            {importState.status === 'importing' && <p className="muted">Importing…</p>}

            {importState.status === 'done' && (
              <>
                <p className="tone-good">
                  Import complete —
                  {importState.subs > 0 && ` ${importState.subs} subscription${importState.subs !== 1 ? 's' : ''}`}
                  {importState.subs > 0 && importState.hist > 0 && ','}
                  {importState.hist > 0 && ` ${importState.hist} history entr${importState.hist !== 1 ? 'ies' : 'y'}`}
                  {importState.subs === 0 && importState.hist === 0 && ' nothing to import'}
                </p>
                <div><button type="button" onClick={() => setImportState({ status: 'idle' })}>Import again</button></div>
              </>
            )}

            {importState.status === 'error' && (
              <>
                <p className="tone-bad" role="alert">{importState.message}</p>
                <div><button type="button" onClick={() => setImportState({ status: 'idle' })}>Try again</button></div>
              </>
            )}
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup heading="Backups">
        {!isDesktop ? (
          <p className="muted">Available in the desktop app only.</p>
        ) : (
          <BackupSettings device={desktop_device()} data_name="subscriptions, playlists, watch history and settings" on_restored={() => window.location.reload()} />
        )}
      </SettingsGroup>

      {isDesktop && (
        <SettingsGroup heading="Playlist history">
          <SettingRow label="Keep playlist changes for" hint="Days of older versions kept for each of your playlists, from the next start. Each playlist always keeps its newest.">
            <NumberField label="Days to keep playlist changes" bare min={1} value={historyDays} on_change={handleHistoryDaysChange} />
          </SettingRow>
        </SettingsGroup>
      )}

      <PluginSettings host={pluginManager.host} />
    </PageLayout>
  )
}
