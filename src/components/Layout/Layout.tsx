import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { Shell } from '@x-tech-laboratories/x-libs/web/react/shell'
import { SearchBox } from '@x-tech-laboratories/x-libs/web/react/controls'
import { Avatar } from '@x-tech-laboratories/x-libs/web/react/media'
import { use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { theme } from '../../theme'
import { parseVideoId, parseChannelUrl } from '../../utils/youtube'
import { getSubscriptions, subscribe } from '../../db/index'
import { subscriptions_watch } from '../../db/watches'
import { downloadAvatar } from '../../utils/avatar'
import { getChannelInfoCached } from '../../services/metadata'
import type { Subscription } from '../../types'

// ============================================================================
// Sidebar
// ============================================================================

const sections = [
  ['/subscriptions', 'Subscriptions'],
  ['/channels', 'Channels'],
  ['/playlists', 'Playlists'],
  ['/history', 'History'],
] as const

function Sidebar({ subscriptions }: { subscriptions: Subscription[] }) {
  return (
    <>
      {sections.map(([path, label]) => <NavLink key={path} to={path}>{label}</NavLink>)}
      {subscriptions.length > 0 && (
        <div className="sidebar-subs" role="group" aria-labelledby="sidebar-subs-label">
          <p className="sidebar-subs-label" id="sidebar-subs-label">Channels</p>
          {subscriptions.map(subscription => (
            <Link key={subscription.channelId} to={`/channel/${subscription.channelId}`} className="sidebar-sub">
              <Avatar src={subscription.avatar} name={subscription.channelName} size="small" />
              <span className="sidebar-sub-name">{subscription.channelName}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================================================
// Search
// ============================================================================

// A pasted or typed video or channel link opens it; anything else searches.
function TopbarSearch() {
  const navigate = useNavigate()

  function submit(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return
    const videoId = parseVideoId(trimmed)
    const channelId = videoId ? null : parseChannelUrl(trimmed)
    if (videoId) navigate(`/watch/${videoId}`)
    else if (channelId) navigate(`/channel/${encodeURIComponent(channelId)}`)
    else navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  // A pasted link is opened whole instead of landing in the box.
  function paste(text: string): boolean {
    if (!parseVideoId(text) && !parseChannelUrl(text)) return false
    submit(text)
    return true
  }

  return <SearchBox label="Search or paste a YouTube URL…" value="" on_submit={submit} on_paste={paste} submit_label="Search" clear_on_submit />
}

// ============================================================================
// Layout
// ============================================================================

export default function Layout() {
  const { pathname } = useLocation()
  const subscriptions = use_resource(getSubscriptions, [], { watch: subscriptions_watch })

  // Refreshes each subscription's avatar on startup, one at a time with a pause between.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await getSubscriptions()
      for (let i = 0; i < list.length && !cancelled; i++) {
        if (i > 0) await new Promise<void>(r => setTimeout(r, 800))
        if (cancelled) break
        const sub = list[i]
        try {
          const info = await getChannelInfoCached(sub.channelId)
          if (info.avatar && !cancelled) {
            const blob = await downloadAvatar(info.avatar)
            if (blob && !cancelled) await subscribe(sub.channelId, sub.channelName, blob)
          }
        } catch { /* skip unreachable channels */ }
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <Shell brand="X-Stream" theme={theme} sidebar={<Sidebar subscriptions={subscriptions.data ?? []} />} tools={<TopbarSearch />} settings={{ href: '#/settings', active: pathname.startsWith('/settings') }} view_key={pathname}>
      <Outlet />
    </Shell>
  )
}
