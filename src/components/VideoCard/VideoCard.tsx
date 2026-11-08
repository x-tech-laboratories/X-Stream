import { Link } from 'react-router-dom'
import { format_clock } from '@x-tech-laboratories/x-libs/durations'
import { MediaTile } from '@x-tech-laboratories/x-libs/web/react/media'
import { MenuButton } from '@x-tech-laboratories/x-libs/web/react/menu_button'
import type { MenuItem } from '@x-tech-laboratories/x-libs/web/react/menus'
import { Age } from '@x-tech-laboratories/x-libs/web/react/time'
import { toast } from '@x-tech-laboratories/x-libs/web/react/toasts'
import { recordWatch } from '../../db/index'
import { formatViews } from '../../utils/format'
import { openInBrowser } from '../../utils/desktop'
import { pick_playlists_for } from '../../utils/playlist_picker'

interface VideoCardProps {
  videoId: string
  title: string
  thumbnail?: string
  duration?: number
  channelId?: string
  channelName?: string
  dimmed?: boolean
  // Replaces the views and upload date line.
  meta?: React.ReactNode
  viewCount?: number
  publishedAt?: string
  // Already written by YouTube, such as "1.4M views" and "2 weeks ago".
  viewCountText?: string
  publishedText?: string
  onRemove?: () => void
  removeLabel?: string
  // Called once the video is marked watched, so lists can refresh.
  onMarkWatched?: () => void
}

export function watch_url(video_id: string): string {
  return `https://www.youtube.com/watch?v=${video_id}`
}

// Copies the text and says so, or says the copy failed.
export function copy_text(text: string, done_message: string): void {
  navigator.clipboard.writeText(text).then(() => toast(done_message), () => toast('Could not copy the link.'))
}

// A video's length over its thumbnail, or nothing for a live or unknown one.
export function video_length(seconds?: number): string | undefined {
  return seconds ? format_clock(seconds * 1000) : undefined
}

export default function VideoCard({
  videoId, title, thumbnail, duration,
  channelId, channelName,
  dimmed, meta, viewCount, publishedAt, viewCountText, publishedText,
  onRemove, removeLabel, onMarkWatched,
}: VideoCardProps) {
  const views = viewCountText ?? (viewCount !== undefined ? formatViews(viewCount) : undefined)
  const uploaded = publishedText ?? (publishedAt ? <Age epoch={Date.parse(publishedAt) / 1000} /> : undefined)

  const menu_items = (): MenuItem[] => [
    {
      label: 'Mark as watched',
      run: () => {
        recordWatch(videoId, title, channelId ?? '', channelName ?? '', thumbnail ?? '', duration ?? 0)
          .then(() => { toast('Marked as watched.'); onMarkWatched?.() })
          .catch(() => toast('Could not mark it as watched.'))
      },
    },
    { label: 'Open in YouTube', run: () => void openInBrowser(watch_url(videoId)) },
    { label: 'Copy link', run: () => copy_text(watch_url(videoId), 'Link copied.') },
    {
      label: 'Add to playlist',
      run: () => pick_playlists_for({
        videoId, title,
        channelId: channelId ?? '',
        channelName: channelName ?? '',
        thumbnail: thumbnail ?? '',
        duration: duration ?? 0,
        viewCountText, publishedText,
      }),
    },
  ]

  return (
    <MediaTile
      title={title}
      href={`#/watch/${videoId}`}
      image={thumbnail}
      corner={video_length(duration)}
      dimmed={dimmed}
      lines={[
        channelId && channelName && <Link to={`/channel/${channelId}`}>{channelName}</Link>,
        meta ?? ((views || uploaded) && <>{views}{views && uploaded && ' · '}{uploaded}</>),
      ]}
      actions={<>
        <MenuButton label={`Options for ${title}`} items={menu_items} />
        {onRemove && <button type="button" className="icon" onClick={onRemove} aria-label={removeLabel} title="Remove">✕</button>}
      </>}
    />
  )
}
