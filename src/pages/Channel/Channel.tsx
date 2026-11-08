import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { compact_count } from '@x-tech-laboratories/x-libs/web/format'
import { Chip, Chips } from '@x-tech-laboratories/x-libs/web/react/badges'
import { Select, Switch } from '@x-tech-laboratories/x-libs/web/react/controls'
import { Facts, Tabs, type Fact, type TabItem } from '@x-tech-laboratories/x-libs/web/react/layout'
import { Avatar, MediaGrid, MediaTile } from '@x-tech-laboratories/x-libs/web/react/media'
import { use_reveal } from '@x-tech-laboratories/x-libs/web/react/reveal'
import { Empty, Loaded, Skeleton, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { pluginManager } from '../../plugins/manager'
import type { ChannelInfo, SearchResult, ChannelPlaylist } from '../../plugins/types'
import { isSubscribed, subscribe, unsubscribe, getSettings, saveSettings, getWatchedVideoIds } from '../../db/index'
import { downloadAvatar } from '../../utils/avatar'
import { getOrFetchChannelVideos } from '../../services/videoCache'
import { getChannelInfoCached } from '../../services/metadata'
import { isPlaylistSubscribed, subscribeToPlaylist, unsubscribeFromPlaylist } from '../../db/playlists'
import PageLayout from '../../components/PageLayout'
import VideoCard from '../../components/VideoCard'
import ChannelCard from '../../components/ChannelCard'
import './Channel.css'

type Tab = 'videos' | 'playlists' | 'channels'

const PAGE_SIZE = 24

// YouTube's own filter names; YouTube sorts, since the only dates it gives are shared labels such as "8 years ago".
type SortMode = 'Latest' | 'Popular' | 'Oldest'

const SORT_OPTIONS: [SortMode, string][] = [
  ['Latest', 'Newest'],
  ['Oldest', 'Oldest'],
  ['Popular', 'Most popular'],
]

// ============================================================================
// Playlists
// ============================================================================

// A playlist on a channel page; subscribing stores a copy of its videos, so it fetches them first.
function ChannelPlaylistTile({ playlist, channelName, channelId }: { playlist: ChannelPlaylist; channelName: string; channelId: string }) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    isPlaylistSubscribed(playlist.playlistId)
      .then(value => { if (!cancelled) setSubscribed(value) })
      .catch(() => { if (!cancelled) setSubscribed(false) })
    return () => { cancelled = true }
  }, [playlist.playlistId])

  async function toggle() {
    if (subscribed === null || busy) return
    setBusy(true)
    try {
      if (subscribed) {
        await unsubscribeFromPlaylist(playlist.playlistId)
        setSubscribed(false)
        return
      }
      const detail = await pluginManager.getActive().getPlaylist?.(playlist.playlistId)
      await subscribeToPlaylist({
        playlistId: playlist.playlistId,
        title: detail?.title || playlist.title,
        author: detail?.author || channelName,
        authorId: detail?.authorId || channelId,
        thumbnail: playlist.thumbnail,
        description: detail?.description,
        videos: (detail?.videos ?? []).map(v => ({
          videoId: v.videoId,
          title: v.title,
          channelId: v.channelId,
          channelName: v.channelName,
          thumbnail: v.thumbnail,
          duration: v.duration,
          viewCountText: v.viewCountText,
          publishedText: v.publishedText,
        })),
      })
      setSubscribed(true)
    } catch {
      // The button stays as it was rather than claiming success.
    } finally {
      setBusy(false)
    }
  }

  return (
    <MediaTile
      title={playlist.title}
      href={`#/playlist/yt/${playlist.playlistId}`}
      image={playlist.thumbnail}
      corner={playlist.videoCount !== undefined ? `${playlist.videoCount} videos` : undefined}
      actions={
        <button type="button" className={subscribed ? undefined : 'accent solid'} onClick={toggle} disabled={subscribed === null || busy} aria-label={`${subscribed ? 'Unsubscribe from' : 'Subscribe to'} ${playlist.title}`}>
          {busy ? '…' : subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      }
    />
  )
}

// ============================================================================
// Details
// ============================================================================

// When the channel joined, its totals, where it is, and its tags.
function ChannelDetails({ info }: { info: ChannelInfo }) {
  const facts: (Fact | false)[] = [
    !!info.joinedText && ['Joined', info.joinedText.replace(/^Joined\s+/i, '')],
    !!info.totalViewsText && ['Views', info.totalViewsText.replace(/\s*views$/i, '')],
    !!info.videoCountText && ['Videos', info.videoCountText.replace(/\s*videos?$/i, '')],
    !!info.country && ['Location', info.country],
  ]
  const tags = info.tags ?? []
  if (!facts.some(Boolean) && tags.length === 0) return null

  return (
    <section className="channel-details" aria-label="Details">
      <Facts rows={facts} />
      {tags.length > 0 && <Chips>{tags.map(tag => <Chip key={tag}>{tag}</Chip>)}</Chips>}
    </section>
  )
}

// ============================================================================
// Videos
// ============================================================================

interface VideoOptions {
  sort_mode: SortMode
  // The search sent, which shows its results in place of the whole list until the box is cleared.
  search: string
  hide_watched: boolean
  watched_style: 'normal' | 'dim' | 'hide'
  watched_ids: Set<string>
}

function ChannelVideos({ channelId, options }: { channelId: string; options: VideoOptions }) {
  const { sort_mode, search, hide_watched, watched_style, watched_ids } = options
  const [videos, setVideos] = useState<SearchResult[] | null>(null)
  const found = use_resource(async () => {
    const plugin = pluginManager.getActive()
    if (!search) return null
    return plugin.searchChannelVideos ? plugin.searchChannelVideos(channelId, search) : []
  }, [channelId, search])
  const { shown_count, more_ref, reset } = use_reveal(PAGE_SIZE)

  // Fetched again for each order, following continuations until the channel has no more.
  useEffect(() => {
    setVideos(null)
    reset()
    let cancelled = false
    getOrFetchChannelVideos(channelId, fresh => {
      if (!cancelled) setVideos(fresh as SearchResult[])
    }, Infinity, sort_mode).then(cached => {
      if (cached && !cancelled) setVideos(cached as SearchResult[])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [channelId, sort_mode])

  useEffect(reset, [search])

  if (search && found.loading) return <Skeleton lines={4} />
  const source = search ? found.data : videos
  if (source === null) return <Skeleton lines={4} />
  if (source.length === 0) return <Empty title={search ? `No videos matching "${search}".` : 'No videos found.'} />

  const should_hide = hide_watched || watched_style === 'hide'
  const visible = should_hide ? source.filter(video => !watched_ids.has(video.videoId)) : source

  return (
    <>
      <MediaGrid label="Videos">
        {visible.slice(0, shown_count).map(video => (
          <VideoCard
            key={video.videoId}
            videoId={video.videoId}
            title={video.title}
            thumbnail={video.thumbnail}
            duration={video.duration}
            viewCountText={video.viewCountText}
            publishedText={video.publishedText}
            dimmed={watched_ids.has(video.videoId) && !should_hide && watched_style === 'dim'}
          />
        ))}
      </MediaGrid>
      {shown_count < visible.length && <div ref={more_ref} aria-hidden="true" />}
    </>
  )
}

// ============================================================================
// Channel
// ============================================================================

export default function Channel() {
  const { channelId = '' } = useParams<{ channelId: string }>()
  return <ChannelView key={channelId} channelId={channelId} />
}

function ChannelView({ channelId }: { channelId: string }) {
  const [tab, setTab] = useState<Tab>('videos')
  const [subscribed, setSubscribed] = useState(false)
  const [playlistsOpened, setPlaylistsOpened] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('Latest')
  // What is typed, apart from the search sent, so a request goes only on Enter.
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [hideWatched, setHideWatched] = useState<boolean | null>(null)
  const watched = use_resource(async () => {
    const [settings, ids] = await Promise.all([getSettings(), getWatchedVideoIds()])
    return { style: settings.watchedVideoStyle ?? 'normal', ids, hide: settings.channelPageHideWatched ?? false }
  }, [])
  const info = use_resource(async () => {
    const channel = await getChannelInfoCached(channelId)
    isSubscribed(channelId).then(async subbed => {
      setSubscribed(subbed)
      if (subbed && channel.avatar) {
        const blob = await downloadAvatar(channel.avatar)
        if (blob) subscribe(channel.channelId, channel.name, blob).catch(() => {})
      }
    }).catch(() => {})
    return channel
  }, [channelId])
  // Loaded the first time their tab opens, then kept.
  const playlists = use_resource(async () => {
    if (!playlistsOpened) return null
    const plugin = pluginManager.getActive()
    return plugin.getChannelPlaylists ? plugin.getChannelPlaylists(channelId).catch(() => []) : []
  }, [channelId, playlistsOpened])
  // Loaded straight away, since the only way to know whether to show its tab is to look.
  const featured = use_resource(async () => {
    const plugin = pluginManager.getActive()
    return plugin.getFeaturedChannels ? plugin.getFeaturedChannels(channelId).catch(() => []) : []
  }, [channelId])

  useEffect(() => {
    const refresh = () => void watched.reload(true)
    window.addEventListener('history-changed', refresh)
    return () => window.removeEventListener('history-changed', refresh)
  }, [])

  const hide = hideWatched ?? watched.data?.hide ?? false

  function chooseTab(next: Tab) {
    setTab(next)
    if (next === 'playlists') setPlaylistsOpened(true)
  }

  async function toggleSubscribe() {
    if (!info.data) return
    if (subscribed) {
      await unsubscribe(channelId)
      setSubscribed(false)
    } else {
      await subscribe(channelId, info.data.name, info.data.avatar)
      setSubscribed(true)
    }
  }

  return (
    <Loaded resource={info} lines={6}>
      {channel => {
        const tabs: TabItem<Tab>[] = [
          { id: 'videos', label: 'Videos' },
          ...(channel.hasPlaylists !== false ? [{ id: 'playlists' as const, label: 'Playlists' }] : []),
          ...((featured.data?.length ?? 0) > 0 ? [{ id: 'channels' as const, label: 'Channels' }] : []),
        ]
        return (
          <PageLayout
            className="channel-page"
            title={channel.name}
            subtitle={channel.subscriberCount !== undefined ? `${compact_count(channel.subscriberCount)} subscribers` : undefined}
            icon={channel.avatar ? <Avatar src={channel.avatar} name={channel.name} size="large" /> : undefined}
            actions={
              <button type="button" className={subscribed ? undefined : 'accent solid'} onClick={toggleSubscribe}>
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            }
            banner={channel.banner}
            extra={<>
              {channel.description && <p className="channel-description">{channel.description}</p>}
              <ChannelDetails info={channel} />
            </>}
            tabs={
              <div className="channel-tabs">
                <Tabs<Tab> label="Channel" items={tabs} active={tab} on_select={chooseTab} />
                {tab === 'videos' && (
                  <div className="toolbar channel-tools">
                    <form role="search" onSubmit={event => { event.preventDefault(); setSearch(searchDraft.trim()) }}>
                      <input
                        type="search"
                        className="filter"
                        placeholder="Search this channel…"
                        value={searchDraft}
                        onChange={event => {
                          setSearchDraft(event.target.value)
                          // Clearing the box goes straight back to the whole list.
                          if (!event.target.value) setSearch('')
                        }}
                        aria-label="Search this channel"
                      />
                    </form>
                    {!search && <Select<SortMode> label="Sort videos" bare options={SORT_OPTIONS} value={sortMode} on_change={setSortMode} />}
                    <label className="check">
                      <Switch
                        label="Unwatched only"
                        checked={hide}
                        on_change={next => {
                          setHideWatched(next)
                          saveSettings({ channelPageHideWatched: next }).catch(() => {})
                        }}
                      />
                      Unwatched only
                    </label>
                  </div>
                )}
              </div>
            }
          >
            {tab === 'videos' && (
              <ChannelVideos
                channelId={channelId}
                options={{ sort_mode: sortMode, search, hide_watched: hide, watched_style: watched.data?.style ?? 'normal', watched_ids: watched.data?.ids ?? new Set() }}
              />
            )}

            {tab === 'playlists' && (
              <Loaded resource={playlists} lines={4}>
                {found => !found?.length
                  ? <Empty title="No playlists found." />
                  : (
                    <MediaGrid label="Playlists">
                      {found.map(playlist => <ChannelPlaylistTile key={playlist.playlistId} playlist={playlist} channelName={channel.name} channelId={channel.channelId} />)}
                    </MediaGrid>
                  )}
              </Loaded>
            )}

            {tab === 'channels' && (
              <Loaded resource={featured} lines={4}>
                {found => found.length === 0
                  ? <Empty title="This channel doesn't feature any others." />
                  : (
                    <div className="grid channel-grid" role="list" aria-label="Featured channels">
                      {found.map(other => <ChannelCard key={other.channelId} channelId={other.channelId} name={other.name} avatar={other.avatar} />)}
                    </div>
                  )}
              </Loaded>
            )}
          </PageLayout>
        )
      }}
    </Loaded>
  )
}
