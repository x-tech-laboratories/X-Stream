import { useEffect, useState } from 'react'
import { SearchBox, Switch } from '@x-tech-laboratories/x-libs/web/react/controls'
import { Empty, Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { getSubscriptions, getWatchedChannelIds, getSettings, saveSettings } from '../../db/index'
import PageLayout from '../../components/PageLayout'
import ChannelCard from '../../components/ChannelCard'

async function load_channels() {
  const [subscriptions, watched_channel_ids, settings] = await Promise.all([getSubscriptions(), getWatchedChannelIds(), getSettings()])
  return { subscriptions, watched_channel_ids, hide_watched: settings.channelsHideWatched ?? false }
}

export default function Channels() {
  const channels = use_resource(load_channels, [])
  const [unsubscribed, setUnsubscribed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [hideWatched, setHideWatched] = useState<boolean | null>(null)

  useEffect(() => {
    const refresh = () => void channels.reload(true)
    window.addEventListener('history-changed', refresh)
    return () => window.removeEventListener('history-changed', refresh)
  }, [])

  const subs = (channels.data?.subscriptions ?? []).filter(sub => !unsubscribed.has(sub.channelId))
  const hide = hideWatched ?? channels.data?.hide_watched ?? false

  function changeHideWatched(next: boolean) {
    setHideWatched(next)
    saveSettings({ channelsHideWatched: next }).catch(() => {})
  }

  const wanted = filter.toLowerCase()
  const visible = subs
    .filter(sub => !hide || !channels.data?.watched_channel_ids.has(sub.channelId))
    .filter(sub => !wanted || sub.channelName.toLowerCase().includes(wanted))

  return (
    <PageLayout
      title="Channels"
      actions={subs.length > 0 ? (
        <>
          <label className="check">
            <Switch label="Unwatched only" checked={hide} on_change={changeHideWatched} />
            Unwatched only
          </label>
          <SearchBox label="Filter channels…" value={filter} on_input={setFilter} />
        </>
      ) : undefined}
    >
      <Loaded resource={channels} lines={4}>
        {() => subs.length === 0
          ? <Empty title="You haven't subscribed to any channels yet." hint="Subscribe from a video's watch page or channel page." />
          : visible.length === 0
            ? <Empty title={hide && !filter ? 'All channels have been watched.' : `No channels match "${filter}".`} />
            : (
              <div className="grid channel-grid" role="list" aria-label="Subscribed channels">
                {visible.map(sub => (
                  <ChannelCard
                    key={sub.channelId}
                    channelId={sub.channelId}
                    name={sub.channelName}
                    avatar={sub.avatar}
                    onSubscriptionChange={subscribed => {
                      if (!subscribed) setUnsubscribed(before => new Set(before).add(sub.channelId))
                    }}
                  />
                ))}
              </div>
            )}
      </Loaded>
    </PageLayout>
  )
}
