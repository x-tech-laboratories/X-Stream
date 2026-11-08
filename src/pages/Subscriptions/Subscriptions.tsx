import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Segmented, Switch } from '@x-tech-laboratories/x-libs/web/react/controls'
import { MediaGrid, Avatar } from '@x-tech-laboratories/x-libs/web/react/media'
import { Empty, Skeleton, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { getSubscriptions, getSettings, saveSettings, getWatchedVideoIds, getAllCachedChannelVideos, getStaleChannelIds } from '../../db/index'
import { history_watch } from '../../db/watches'
import { refreshChannelVideos } from '../../services/videoCache'
import PageLayout from '../../components/PageLayout'
import VideoCard from '../../components/VideoCard'
import type { Subscription } from '../../types'
import type { SearchResult } from '../../plugins/types'

type Section =
  | { channel: Subscription; status: 'loading' }
  | { channel: Subscription; status: 'done'; videos: SearchResult[] }
  | { channel: Subscription; status: 'error' }

type SortMode = 'channel' | 'date'

const VIDEOS_PER_CHANNEL = 8
const BATCH_SIZE = 3

async function load_watched() {
  const [settings, ids] = await Promise.all([getSettings(), getWatchedVideoIds()])
  return { style: settings.watchedVideoStyle ?? 'normal', ids, hide: settings.feedHideWatched ?? false, sort: settings.feedSortMode ?? 'channel' }
}

export default function Subscriptions() {
  const [sections, setSections] = useState<Section[]>([])
  const [initialising, setInitialising] = useState(true)
  const watched = use_resource(load_watched, [], { watch: history_watch })
  const [hideChoice, setHideChoice] = useState<boolean | null>(null)
  const [sortChoice, setSortChoice] = useState<SortMode | null>(null)
  const watchedIds = watched.data?.ids ?? new Set<string>()
  const watchedStyle = watched.data?.style ?? 'normal'
  const hideWatched = hideChoice ?? watched.data?.hide ?? false
  const sortMode = sortChoice ?? watched.data?.sort ?? 'channel'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [subs, allCaches] = await Promise.all([getSubscriptions(), getAllCachedChannelVideos()])
      if (cancelled) return
      if (!subs.length) { setInitialising(false); return }

      setSections(subs.map(channel => {
        const cached = allCaches.get(channel.channelId)
        return cached
          ? { channel, status: 'done' as const, videos: cached as SearchResult[] }
          : { channel, status: 'loading' as const }
      }))
      setInitialising(false)

      // Refresh only channels whose cache has expired. Without this every visit
      // refetched all subscriptions, which dominated the page's load time.
      const staleIds = await getStaleChannelIds(subs.map(s => s.channelId))
      if (cancelled) return
      const toRefresh = subs.filter(s => staleIds.has(s.channelId))

      for (let i = 0; i < toRefresh.length; i += BATCH_SIZE) {
        if (cancelled) break
        const batch = toRefresh.slice(i, i + BATCH_SIZE)
        await Promise.allSettled(batch.map(async sub => {
          try {
            await refreshChannelVideos(
              sub.channelId,
              fresh => {
                if (!cancelled) setSections(prev => prev.map(s =>
                  s.channel.channelId === sub.channelId
                    ? { channel: sub, status: 'done', videos: fresh as SearchResult[] }
                    : s
                ))
              },
              VIDEOS_PER_CHANNEL,
            )
          } catch {
            if (!cancelled) setSections(prev => prev.map(s =>
              s.channel.channelId === sub.channelId ? { channel: sub, status: 'error' } : s
            ))
          }
        }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (initialising) return <Skeleton lines={4} />

  if (!sections.length) return (
    <Empty title="You haven't subscribed to any channels yet." hint="Subscribe from a video's watch page or channel page." />
  )

  const shouldHide = hideWatched || watchedStyle === 'hide'

  const doneSections = sections.filter((s): s is Extract<Section, { status: 'done' }> => s.status === 'done')
  const loadingCount = sections.filter(s => s.status === 'loading').length

  const allVideos = sortMode === 'date'
    ? doneSections
        .flatMap(s => s.videos.map(v => ({ ...v, channel: s.channel })))
        .filter(v => !shouldHide || !watchedIds.has(v.videoId))
        .sort((a, b) => {
          if (!a.publishedAt && !b.publishedAt) return 0
          if (!a.publishedAt) return 1
          if (!b.publishedAt) return -1
          return b.publishedAt.localeCompare(a.publishedAt)
        })
    : []

  return (
    <PageLayout
      title="Subscriptions"
      actions={
        <>
          <Segmented<SortMode>
            label="Order"
            choices={[{ value: 'channel', label: 'By channel' }, { value: 'date', label: 'By date' }]}
            value={sortMode}
            on_change={mode => {
              setSortChoice(mode)
              saveSettings({ feedSortMode: mode }).catch(() => {})
            }}
          />
          <label className="check">
            <Switch
              label="Unwatched only"
              checked={hideWatched}
              on_change={next => {
                setHideChoice(next)
                saveSettings({ feedHideWatched: next }).catch(() => {})
              }}
            />
            Unwatched only
          </label>
        </>
      }
    >
      {sortMode === 'date' && (
        <>
          {loadingCount > 0 && (
            <p className="muted" aria-live="polite">
              Loading {loadingCount} of {sections.length} channel{sections.length !== 1 ? 's' : ''}…
            </p>
          )}
          {allVideos.length === 0 && loadingCount === 0 ? (
            <Empty title="No videos found." />
          ) : (
            <MediaGrid label="Recent videos">
              {allVideos.map(v => (
                <VideoCard
                  key={v.videoId}
                  videoId={v.videoId}
                  title={v.title}
                  thumbnail={v.thumbnail}
                  duration={v.duration}
                  viewCountText={v.viewCountText}
                  publishedText={v.publishedText}
                  channelId={v.channel.channelId}
                  channelName={v.channel.channelName}
                  dimmed={watchedIds.has(v.videoId) && !shouldHide && watchedStyle === 'dim'}
                />
              ))}
            </MediaGrid>
          )}
        </>
      )}

      {sortMode === 'channel' && sections.map(section => {
        const videos = section.status === 'done'
          ? (shouldHide ? section.videos.filter(v => !watchedIds.has(v.videoId)) : section.videos)
          : []

        if (section.status === 'done' && !videos.length) return null

        return (
          <section key={section.channel.channelId} className="feed-section" aria-label={section.channel.channelName}>
            <Link to={`/channel/${section.channel.channelId}`} className="feed-channel">
              <Avatar src={section.channel.avatar} name={section.channel.channelName} size="small" />
              <h2>{section.channel.channelName}</h2>
            </Link>

            {section.status === 'loading' && <Skeleton lines={2} />}
            {section.status === 'error' && <p className="tone-bad">Failed to load videos.</p>}
            {section.status === 'done' && (
              <MediaGrid label={`Videos from ${section.channel.channelName}`}>
                {videos.map(v => (
                  <VideoCard
                    key={v.videoId}
                    videoId={v.videoId}
                    title={v.title}
                    thumbnail={v.thumbnail}
                    duration={v.duration}
                    viewCountText={v.viewCountText}
                    publishedText={v.publishedText}
                    dimmed={watchedIds.has(v.videoId) && !shouldHide && watchedStyle === 'dim'}
                  />
                ))}
              </MediaGrid>
            )}
          </section>
        )
      })}
    </PageLayout>
  )
}
