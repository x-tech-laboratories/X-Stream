import { useEffect, useRef, useState } from 'react'
import { Badge } from '@x-tech-laboratories/x-libs/web/react/badges'
import { confirm_dialog } from '@x-tech-laboratories/x-libs/web/react/dialog'
import { MediaGrid } from '@x-tech-laboratories/x-libs/web/react/media'
import { use_reveal } from '@x-tech-laboratories/x-libs/web/react/reveal'
import { Empty, Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { Age } from '@x-tech-laboratories/x-libs/web/react/time'
import { getHistory, removeFromHistory, clearHistory } from '../../db/index'
import PageLayout from '../../components/PageLayout'
import VideoCard from '../../components/VideoCard'
import { thumbnailUrl } from '../../utils/avatar'

const PAGE_SIZE = 24
const SESSION_KEY = 'history-scroll'

// Where the page was left, so coming back to it lands in the same place.
function left_at(): { count: number; scroll_y: number } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}')
    return { count: Number(saved.count) || PAGE_SIZE, scroll_y: Number(saved.scrollY) || 0 }
  } catch {
    return { count: PAGE_SIZE, scroll_y: 0 }
  }
}

export default function History() {
  const history = use_resource(getHistory, [])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [start] = useState(left_at)
  const { shown_count, more_ref, reset } = use_reveal(PAGE_SIZE, { initial_count: start.count })
  const shown_count_now = useRef(shown_count)
  shown_count_now.current = shown_count
  const scroll_restored = useRef(false)

  useEffect(() => {
    const refresh = () => void history.reload(true)
    window.addEventListener('history-changed', refresh)
    return () => {
      window.removeEventListener('history-changed', refresh)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ scrollY: window.scrollY, count: shown_count_now.current }))
    }
  }, [])

  useEffect(() => {
    if (!history.data?.length || scroll_restored.current) return
    scroll_restored.current = true
    if (start.scroll_y > 0) window.scrollTo(0, start.scroll_y)
  }, [history.data])

  async function remove(videoId: string) {
    await removeFromHistory(videoId)
    setRemoved(before => new Set(before).add(videoId))
  }

  function clear_all() {
    confirm_dialog({
      title: 'Clear watch history',
      message: 'Remove every video from your watch history? This cannot be undone.',
      confirm_label: 'Clear history',
      danger: true,
      run: async () => {
        await clearHistory()
        reset()
        await history.reload(true)
      },
    })
  }

  const entries = (history.data ?? []).filter(entry => !removed.has(entry.videoId))

  return (
    <PageLayout
      title="Watch History"
      actions={entries.length > 0 ? <button type="button" className="danger" onClick={clear_all}>Clear all</button> : undefined}
    >
      <Loaded resource={history} lines={4}>
        {() => entries.length === 0
          ? <Empty title="No watch history yet." hint="Videos you watch will appear here." />
          : (
            <>
              <MediaGrid label="Watched videos">
                {entries.slice(0, shown_count).map(entry => (
                  <VideoCard
                    key={entry.videoId}
                    videoId={entry.videoId}
                    title={entry.title}
                    thumbnail={thumbnailUrl(entry.thumbnail, entry.videoId)}
                    duration={entry.duration}
                    channelId={entry.channelId}
                    channelName={entry.channelName}
                    meta={<>
                      <Age epoch={Date.parse(entry.watchedAt) / 1000} />
                      {entry.watchCount > 1 && <> <Badge title={`Watched ${entry.watchCount} times`}>{entry.watchCount}×</Badge></>}
                    </>}
                    onRemove={() => void remove(entry.videoId)}
                    removeLabel={`Remove ${entry.title} from history`}
                  />
                ))}
              </MediaGrid>
              {shown_count < entries.length && <div ref={more_ref} aria-hidden="true" />}
            </>
          )}
      </Loaded>
    </PageLayout>
  )
}
