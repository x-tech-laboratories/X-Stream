import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@x-tech-laboratories/x-libs/web/react/media'
import { isSubscribed, subscribe, unsubscribe } from '../../db/index'

interface ChannelCardProps {
  channelId: string
  name: string
  avatar?: string
  // A line under the name, such as "25.4M subscribers".
  meta?: string
  // Called once the subscription changes, so lists can refresh.
  onSubscriptionChange?: (subscribed: boolean) => void
}

// A channel's avatar and name with a subscribe button, in the subscriptions grid and a channel's featured tab.
export default function ChannelCard({ channelId, name, avatar, meta, onSubscriptionChange }: ChannelCardProps) {
  // Unknown until read, so the button never shows the wrong word first.
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    isSubscribed(channelId)
      .then(value => { if (!cancelled) setSubscribed(value) })
      .catch(() => { if (!cancelled) setSubscribed(false) })
    return () => { cancelled = true }
  }, [channelId])

  async function toggle() {
    if (subscribed === null || busy) return
    setBusy(true)
    try {
      if (subscribed) await unsubscribe(channelId)
      else await subscribe(channelId, name, avatar)
      setSubscribed(!subscribed)
      onSubscriptionChange?.(!subscribed)
    } catch {
      // The old state stays, rather than claiming a change that did not happen.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card channel-card" role="listitem">
      <Link to={`/channel/${channelId}`} className="channel-card-link">
        <Avatar src={avatar} name={name} size="large" />
        <strong className="channel-card-name">{name}</strong>
        {meta && <span className="muted small">{meta}</span>}
      </Link>
      <button
        type="button"
        className={subscribed ? undefined : 'accent solid'}
        onClick={toggle}
        disabled={subscribed === null || busy}
        aria-label={subscribed ? `Unsubscribe from ${name}` : `Subscribe to ${name}`}
      >
        {subscribed === null ? '…' : subscribed ? 'Subscribed' : 'Subscribe'}
      </button>
    </div>
  )
}
