import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { confirm_dialog } from '@x-tech-laboratories/x-libs/web/react/dialog'
import { RowActions } from '@x-tech-laboratories/x-libs/web/react/layout'
import { MediaGrid, MediaTile } from '@x-tech-laboratories/x-libs/web/react/media'
import { Empty, Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { Age } from '@x-tech-laboratories/x-libs/web/react/time'
import {
  getPlaylist, deletePlaylist, renamePlaylist,
  removeFromPlaylist, reorderPlaylist,
  getSubscribedPlaylist, unsubscribeFromPlaylist, refreshSubscribedPlaylist,
} from '../../db/playlists'
import { pluginManager } from '../../plugins/manager'
import type { PlaylistVideo, PersonalPlaylist, SubscribedPlaylist } from '../../types'
import PageLayout from '../../components/PageLayout'
import { video_length } from '../../components/VideoCard/VideoCard'

type Found =
  | { kind: 'personal'; doc: PersonalPlaylist }
  | { kind: 'subscribed'; doc: SubscribedPlaylist }
  | { kind: 'missing' }

async function load_playlist(playlistId: string, subscribed: boolean): Promise<Found> {
  if (subscribed) {
    const doc = await getSubscribedPlaylist(playlistId)
    return doc ? { kind: 'subscribed', doc } : { kind: 'missing' }
  }
  const doc = await getPlaylist(playlistId)
  return doc ? { kind: 'personal', doc } : { kind: 'missing' }
}

function video_count(count: number): string {
  return `${count} ${count === 1 ? 'video' : 'videos'}`
}

// `/playlist/yt/:id` is a subscribed YouTube list; `/playlist/:id` is a personal one.
export default function Playlist({ subscribed = false }: { subscribed?: boolean }) {
  const { playlistId = '' } = useParams<{ playlistId: string }>()
  const playlist = use_resource(() => load_playlist(playlistId, subscribed), [playlistId, subscribed])
  const [refreshing, setRefreshing] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  useEffect(() => {
    const refresh = () => void playlist.reload(true)
    window.addEventListener('playlists-changed', refresh)
    return () => window.removeEventListener('playlists-changed', refresh)
  }, [])

  async function handleRefresh() {
    const plugin = pluginManager.getActive()
    if (!plugin.getPlaylist) return
    setRefreshing(true)
    try {
      const fresh = await plugin.getPlaylist(playlistId)
      await refreshSubscribedPlaylist(playlistId, fresh.videos.map(toPlaylistVideo))
    } catch {
      // The stored copy stays rather than being cleared.
    } finally {
      setRefreshing(false)
    }
  }

  function remove_playlist(is_personal: boolean, title: string) {
    confirm_dialog({
      title: is_personal ? 'Delete playlist' : 'Unsubscribe from playlist',
      message: is_personal ? `Delete "${title}"? This cannot be undone.` : `Stop following "${title}" and drop its stored copy?`,
      confirm_label: is_personal ? 'Delete' : 'Unsubscribe',
      danger: true,
      run: async () => {
        if (is_personal) await deletePlaylist(playlistId)
        else await unsubscribeFromPlaylist(playlistId)
        window.history.back()
      },
    })
  }

  return (
    <Loaded resource={playlist} lines={6}>
      {found => {
        if (found.kind === 'missing') return <Empty title="Playlist not found." />
        const { doc } = found
        const isPersonal = found.kind === 'personal'
        const videos = doc.videos

        return (
          <PageLayout
            title={doc.title}
            subtitle={found.kind === 'personal' ? video_count(videos.length) : `${found.doc.author} · ${video_count(videos.length)}`}
            actions={<>
              {!isPersonal && <button type="button" onClick={handleRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
              {isPersonal && !renaming && <button type="button" onClick={() => { setRenaming(true); setDraftTitle(doc.title) }}>Rename</button>}
              <button type="button" className="danger" onClick={() => remove_playlist(isPersonal, doc.title)}>{isPersonal ? 'Delete' : 'Unsubscribe'}</button>
            </>}
            extra={<>
              {renaming && (
                <form
                  className="toolbar"
                  onSubmit={async event => {
                    event.preventDefault()
                    if (!draftTitle.trim()) return
                    await renamePlaylist(playlistId, draftTitle.trim())
                    setRenaming(false)
                  }}
                >
                  <input value={draftTitle} onChange={event => setDraftTitle(event.target.value)} aria-label="Playlist name" autoFocus />
                  <button type="submit" className="accent solid">Save</button>
                  <button type="button" onClick={() => setRenaming(false)}>Cancel</button>
                </form>
              )}
              {found.kind === 'subscribed' && <p className="muted">Snapshot taken <Age epoch={Date.parse(found.doc.fetchedAt) / 1000} />.</p>}
              {doc.description && <p className="playlist-description">{doc.description}</p>}
            </>}
          >
            {videos.length === 0
              ? <Empty title={isPersonal ? 'No videos yet.' : 'This playlist is empty.'} hint={isPersonal ? "Add some from a video's menu." : undefined} />
              : (
                <MediaGrid rows label="Videos">
                  {videos.map((video, index) => (
                    <MediaTile
                      key={video.videoId}
                      lead={index + 1}
                      title={video.title}
                      href={`#/watch/${video.videoId}`}
                      image={video.thumbnail}
                      corner={video_length(video.duration)}
                      lines={[video.channelName, [video.viewCountText, video.publishedText].filter(Boolean).join(' · ')]}
                      actions={isPersonal && (
                        <RowActions
                          index={index}
                          count={videos.length}
                          on_move={(_, to) => void reorderPlaylist(playlistId, video.videoId, to)}
                          on_remove={() => void removeFromPlaylist(playlistId, video.videoId)}
                          remove_label={`Remove ${video.title} from playlist`}
                        />
                      )}
                    />
                  ))}
                </MediaGrid>
              )}
          </PageLayout>
        )
      }}
    </Loaded>
  )
}

function toPlaylistVideo(v: {
  videoId: string; title: string; channelId: string; channelName: string
  thumbnail: string; duration: number; viewCountText?: string; publishedText?: string
}): PlaylistVideo {
  return {
    videoId: v.videoId,
    title: v.title,
    channelId: v.channelId,
    channelName: v.channelName,
    thumbnail: v.thumbnail,
    duration: v.duration,
    viewCountText: v.viewCountText,
    publishedText: v.publishedText,
  }
}
