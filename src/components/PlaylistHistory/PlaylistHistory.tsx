// The history of the user's own playlists: one playlist's versions, opened from the playlist, and the latest changes to
// all of them, opened from the playlists page, where a deleted one can be brought back.

import type { ReactNode } from 'react'
import type { Version, VersionKind } from '@x-tech-laboratories/x-libs/history'
import { StateBadge, type Tone } from '@x-tech-laboratories/x-libs/web/react/badges'
import { confirm_dialog, Dialog, open_dialog } from '@x-tech-laboratories/x-libs/web/react/dialog'
import { Empty, Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { toast } from '@x-tech-laboratories/x-libs/web/react/toasts'

import { playlists_watch } from '../../db/watches'
import type { PlaylistSnapshot } from '../../shared/bridge'
import { desktop_device } from '../../utils/desktop'

type PlaylistVersion = Version<PlaylistSnapshot>

const change_labels: Record<VersionKind, [text: string, tone: Tone]> = {
  first_seen: ['Already here', 'none'],
  created: ['Created', 'good'],
  edited: ['Edited', 'info'],
  deleted: ['Deleted', 'bad'],
  restored: ['Restored', 'warn'],
}

const RECENT_LIMIT = 100

function when(changed_at: string): string {
  return new Date(changed_at).toLocaleString()
}

function video_count(count: number): string {
  return `${count} ${count === 1 ? 'video' : 'videos'}`
}

// Brings the version back after a confirm; the playlist as it is now stays in its history.
function restore(version: PlaylistVersion, on_done?: () => void): void {
  const { title } = version.snapshot
  const deleted = version.kind === 'deleted'
  confirm_dialog({
    title: deleted ? `Bring back ${title}?` : `Restore ${title}?`,
    message: deleted ? 'It comes back as it was when deleted.' : `It goes back to how it was on ${when(version.changed_at)}; the way it is now stays in its history.`,
    confirm_label: deleted ? 'Bring back' : 'Restore',
    run: async () => {
      try {
        await desktop_device().restore_version(version.id)
        playlists_watch.bump()
        toast(`${title} is back as it was`, { tone: 'good' })
        on_done?.()
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), { tone: 'bad' })
      }
    },
  })
}

function VersionRow({ version, action }: { version: PlaylistVersion, action?: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="stack tight">
        <span>{when(version.changed_at)}</span>
        <span className="muted small">{version.snapshot.title} · {video_count(version.snapshot.videos.length)}</span>
      </div>
      <div className="toolbar">
        <StateBadge labels={change_labels} state={version.kind} />
        {action}
      </div>
    </div>
  )
}

// ── One playlist ─────────────────────────────────────────────────────────────

function PlaylistHistoryDialog({ playlist_id, title, on_close }: { playlist_id: string, title: string, on_close: () => void }) {
  const versions = use_resource(() => desktop_device().list_versions(`playlist-${playlist_id}`), [playlist_id])
  return (
    <Dialog title={`History of ${title}`} on_close={on_close}>
      <Loaded resource={versions}>
        {(list) => list.length === 0 ? <Empty title="No history yet." /> : (
          <div className="stack tight">
            {/* The newest version is how the playlist is now, so only the ones before it are offered. */}
            {list.map((version, index) => (
              <VersionRow key={version.id} version={version} action={index > 0 && version.kind !== 'deleted' ? <button type="button" onClick={() => restore(version, on_close)}>Restore</button> : undefined} />
            ))}
          </div>
        )}
      </Loaded>
    </Dialog>
  )
}

export function open_playlist_history(playlist_id: string, title: string): void {
  open_dialog((close) => <PlaylistHistoryDialog playlist_id={playlist_id} title={title} on_close={close} />)
}

// ── Every playlist ───────────────────────────────────────────────────────────

function RecentChangesDialog({ on_close }: { on_close: () => void }) {
  const changes = use_resource(() => desktop_device().list_recent_versions(RECENT_LIMIT), [])
  return (
    <Dialog title="Playlist changes" subtitle={`The latest ${RECENT_LIMIT} changes to your playlists.`} on_close={on_close}>
      <Loaded resource={changes}>
        {(list) => list.length === 0 ? <Empty title="No changes yet." /> : (
          <div className="stack tight">
            {list.map((version) => (
              <VersionRow key={version.id} version={version} action={version.kind === 'deleted' ? <button type="button" onClick={() => restore(version, on_close)}>Bring back</button> : undefined} />
            ))}
          </div>
        )}
      </Loaded>
    </Dialog>
  )
}

export function open_playlist_changes(): void {
  open_dialog((close) => <RecentChangesDialog on_close={close} />)
}
