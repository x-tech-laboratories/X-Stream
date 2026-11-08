import { useEffect, useState } from 'react'
import { MediaGrid, MediaTile } from '@x-tech-laboratories/x-libs/web/react/media'
import { Empty, Loaded, use_resource } from '@x-tech-laboratories/x-libs/web/react/states'
import { getAllPlaylists, createPlaylist } from '../../db/playlists'
import { isPersonalPlaylist } from '../../types'
import PageLayout from '../../components/PageLayout'

function video_count(count: number): string {
  return `${count} ${count === 1 ? 'video' : 'videos'}`
}

export default function Playlists() {
  const playlists = use_resource(getAllPlaylists, [])
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    const refresh = () => void playlists.reload(true)
    window.addEventListener('playlists-changed', refresh)
    return () => window.removeEventListener('playlists-changed', refresh)
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await createPlaylist(title)
    setNewTitle('')
    setCreating(false)
  }

  return (
    <PageLayout
      title="Playlists"
      actions={creating ? undefined : <button type="button" className="accent solid" onClick={() => setCreating(true)}>New playlist</button>}
    >
      {creating && (
        <form className="toolbar" onSubmit={handleCreate}>
          <input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Playlist name" aria-label="Playlist name" autoFocus />
          <button type="submit" className="accent solid" disabled={!newTitle.trim()}>Create</button>
          <button type="button" onClick={() => { setCreating(false); setNewTitle('') }}>Cancel</button>
        </form>
      )}

      <Loaded resource={playlists} lines={4}>
        {all => {
          const personal = all.filter(isPersonalPlaylist)
          const subscribed = all.filter(playlist => !isPersonalPlaylist(playlist))
          if (all.length === 0 && !creating) {
            return <Empty title="No playlists yet." hint="Create one above, or subscribe to a playlist from a channel page." />
          }
          return (
            <>
              {personal.length > 0 && (
                <section className="stack tight" aria-label="Your playlists">
                  <h2>Your playlists</h2>
                  <MediaGrid label="Your playlists">
                    {personal.map(playlist => (
                      <MediaTile
                        key={playlist._id}
                        title={playlist.title}
                        href={`#/playlist/${playlist.playlistId}`}
                        image={playlist.videos[0]?.thumbnail}
                        lines={[video_count(playlist.videos.length)]}
                      />
                    ))}
                  </MediaGrid>
                </section>
              )}
              {subscribed.length > 0 && (
                <section className="stack tight" aria-label="Subscribed">
                  <h2>Subscribed</h2>
                  <MediaGrid label="Subscribed playlists">
                    {subscribed.map(playlist => (
                      <MediaTile
                        key={playlist._id}
                        title={playlist.title}
                        href={`#/playlist/yt/${playlist.playlistId}`}
                        image={playlist.thumbnail || playlist.videos[0]?.thumbnail}
                        lines={[video_count(playlist.videos.length), 'author' in playlist ? playlist.author : '']}
                      />
                    ))}
                  </MediaGrid>
                </section>
              )}
            </>
          )
        }}
      </Loaded>
    </PageLayout>
  )
}
