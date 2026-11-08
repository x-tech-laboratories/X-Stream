import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Tabs } from '@x-tech-laboratories/x-libs/web/react/layout'
import { MediaGrid, MediaTile } from '@x-tech-laboratories/x-libs/web/react/media'
import { Empty, Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { pluginManager } from '../../plugins/manager'
import { getSettings, getWatchedVideoIds } from '../../db/index'
import { history_watch } from '../../db/watches'
import { formatViews } from '../../utils/format'
import ChannelCard from '../../components/ChannelCard'
import PageLayout from '../../components/PageLayout'
import { video_length } from '../../components/VideoCard/VideoCard'
import type { SearchResult } from '../../plugins/types'

type SearchTab = 'videos' | 'channels'

async function load_watched() {
  const [settings, ids] = await Promise.all([getSettings(), getWatchedVideoIds()])
  return { style: settings.watchedVideoStyle ?? 'normal', ids }
}

// ============================================================================
// Results
// ============================================================================

function VideoResults({ query }: { query: string }) {
  const results = use_resource(async () => pluginManager.getActive().search(query), [query])
  const watched = use_resource(load_watched, [], { watch: history_watch })

  const style = watched.data?.style ?? 'normal'
  const watched_ids = watched.data?.ids ?? new Set<string>()
  const shown = (found: SearchResult[]) => style === 'hide' ? found.filter(result => !watched_ids.has(result.videoId)) : found

  return (
    <Loaded resource={results} lines={4}>
      {found => shown(found).length === 0
        ? <Empty title={`No videos for "${query}".`} />
        : (
          <MediaGrid rows label="Videos">
            {shown(found).map(result => {
              // YouTube writes these itself; a raw count is formatted only when it does not.
              const views = result.viewCountText ?? (result.viewCount !== undefined ? formatViews(result.viewCount) : undefined)
              return (
                <MediaTile
                  key={result.videoId}
                  title={result.title}
                  href={`#/watch/${result.videoId}`}
                  image={result.thumbnail}
                  corner={video_length(result.duration)}
                  dimmed={watched_ids.has(result.videoId) && style === 'dim'}
                  lines={[
                    <Link to={`/channel/${result.channelId}`}>{result.channelName}</Link>,
                    [views, result.publishedText].filter(Boolean).join(' · '),
                  ]}
                />
              )
            })}
          </MediaGrid>
        )}
    </Loaded>
  )
}

// Channel results are a request of their own, so they load only when their tab is opened.
function ChannelResults({ query }: { query: string }) {
  const results = use_resource(async () => {
    const plugin = pluginManager.getActive()
    return plugin.searchChannels ? plugin.searchChannels(query) : []
  }, [query])

  return (
    <Loaded resource={results} lines={4}>
      {found => found.length === 0
        ? <Empty title={`No channels for "${query}".`} />
        : (
          <div className="grid channel-grid" role="list" aria-label="Channels">
            {found.map(channel => (
              <ChannelCard key={channel.channelId} channelId={channel.channelId} name={channel.name} avatar={channel.avatar} meta={channel.subscriberCountText} />
            ))}
          </div>
        )}
    </Loaded>
  )
}

// ============================================================================
// Search
// ============================================================================

export default function Search() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const [tab, setTab] = useState<SearchTab>('videos')

  useEffect(() => setTab('videos'), [query])

  if (!query) return <Empty title="Nothing searched yet." hint="Enter a search term or paste a YouTube URL in the bar above." />

  return (
    <PageLayout
      title={`Results for "${query}"`}
      tabs={<Tabs<SearchTab> label="Results" items={[{ id: 'videos', label: 'Videos' }, { id: 'channels', label: 'Channels' }]} active={tab} on_select={setTab} />}
    >
      {tab === 'videos' ? <VideoResults query={query} /> : <ChannelResults query={query} />}
    </PageLayout>
  )
}
