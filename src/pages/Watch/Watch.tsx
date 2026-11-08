import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { compact_count } from '@x-tech-laboratories/x-libs/web/format'
import { Avatar } from '@x-tech-laboratories/x-libs/web/react/media'
import { MenuButton } from '@x-tech-laboratories/x-libs/web/react/menu_button'
import { Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { pluginManager } from '../../plugins/manager'
import type { VideoInfo } from '../../plugins/types'
import { isSubscribed, subscribe, unsubscribe, recordWatch } from '../../db/index'
import { downloadAvatar, thumbnailUrl } from '../../utils/avatar'
import SabrPlayer from '../../components/SabrPlayer'
import Comments from '../../components/Comments'
import { copy_text, watch_url } from '../../components/VideoCard/VideoCard'
import { openInBrowser } from '../../utils/desktop'
import { pick_playlists_for } from '../../utils/playlist_picker'
import './Watch.css'

// Loads the video and records it in the history.
async function load_video(videoId: string): Promise<VideoInfo> {
  const info = await pluginManager.getActive().getVideoInfo(videoId)
  // The thumbnail is kept as a link, fetched only when its History entry scrolls into view.
  recordWatch(
    info.videoId, info.title, info.channelId, info.channelName,
    thumbnailUrl(info.thumbnail, info.videoId), info.duration,
  ).catch(() => {})
  return info
}

export default function Watch() {
  const { videoId = '' } = useParams<{ videoId: string }>()
  const video = use_resource(() => load_video(videoId), [videoId])

  return (
    <div className="watch-page">
      <Loaded resource={video} lines={6}>
        {info => <WatchView info={info} />}
      </Loaded>
    </div>
  )
}

function WatchView({ info }: { info: VideoInfo }) {
  const [subscribed, setSubscribed] = useState(false)
  // Set by the player, so "Copy link at current time" can read the playhead.
  const getCurrentTime = useRef<() => number>(() => 0)
  const handlePlayerReady = useCallback((read_time: () => number) => {
    getCurrentTime.current = read_time
  }, [])

  useEffect(() => {
    isSubscribed(info.channelId).then(setSubscribed).catch(() => {})
  }, [info.channelId])

  async function toggleSubscribe() {
    const { channelId, channelName } = info
    if (subscribed) {
      await unsubscribe(channelId)
      setSubscribed(false)
      return
    }
    await subscribe(channelId, channelName)
    setSubscribed(true)
    // Fetches the avatar in the background and stores it with the subscription.
    pluginManager.getActive()
      .getChannelInfo(channelId)
      .then(async channel => {
        if (!channel.avatar) return
        const blob = await downloadAvatar(channel.avatar)
        if (blob) await subscribe(channelId, channelName, blob)
      })
      .catch(() => {})
  }

  const stats = [
    info.viewCount !== undefined ? `${info.viewCount.toLocaleString()} views` : null,
    info.publishedText,
    info.publishedRelative && info.publishedText !== info.publishedRelative ? info.publishedRelative : null,
  ].filter(Boolean)

  return (
    <>
      <SabrPlayer videoId={info.videoId} title={info.title} onReady={handlePlayerReady} />
      <div className="watch-meta">
        <h1>{info.title}</h1>

        <div className="watch-channel-row">
          <Link to={`/channel/${info.channelId}`} className="watch-channel">
            <Avatar src={info.channelAvatar} name={info.channelName} />
            <span>{info.channelName}</span>
          </Link>
          <button type="button" className={subscribed ? undefined : 'accent solid'} onClick={toggleSubscribe}>
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </button>

          <div className="watch-actions">
            {info.likeCount !== undefined && (
              <span className="muted" title={`${info.likeCount.toLocaleString()} likes`}>
                👍 {compact_count(info.likeCount)}
              </span>
            )}
            <button
              type="button"
              onClick={() => pick_playlists_for({
                videoId: info.videoId,
                title: info.title,
                channelId: info.channelId,
                channelName: info.channelName,
                thumbnail: info.thumbnail,
                duration: info.duration,
              })}
            >
              Add to playlist
            </button>
            <MenuButton
              label="Video options"
              items={() => [
                { label: 'Open in YouTube', run: () => void openInBrowser(watch_url(info.videoId)) },
                { label: 'Copy link', run: () => copy_text(watch_url(info.videoId), 'Link copied.') },
                {
                  label: 'Copy link at current time',
                  run: () => copy_text(`${watch_url(info.videoId)}&t=${Math.floor(getCurrentTime.current())}`, 'Link copied.'),
                },
                { label: 'Open channel in YouTube', run: () => void openInBrowser(`https://www.youtube.com/channel/${info.channelId}`) },
              ]}
            />
          </div>
        </div>

        {stats.length > 0 && <p className="muted">{stats.join(' · ')}</p>}

        {info.description && (
          <details className="watch-description">
            <summary>Description</summary>
            <p>{info.description}</p>
          </details>
        )}
      </div>

      <Comments videoId={info.videoId} />
    </>
  )
}
