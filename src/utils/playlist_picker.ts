// Opens the dialog that adds a video to the user's own playlists.

import { pick_list_dialog, type PickableList } from '@x-tech-laboratories/x-libs/web/react/list_picker'
import { addToPlaylist, createPlaylist, getPlaylists } from '../db/playlists'
import type { PersonalPlaylist, PlaylistVideo } from '../types'

function as_pickable(playlist: PersonalPlaylist, video_id: string): PickableList {
  return {
    id: playlist.playlistId,
    name: playlist.title,
    count: playlist.videos.length,
    holds: playlist.videos.some(video => video.videoId === video_id),
  }
}

export function pick_playlists_for(video: PlaylistVideo): void {
  pick_list_dialog({
    title: 'Add to playlist',
    new_label: 'New playlist',
    empty_text: 'No playlists yet.',
    load: async () => (await getPlaylists()).map(playlist => as_pickable(playlist, video.videoId)),
    add: id => addToPlaylist(id, video),
    create: async name => {
      const playlist = await createPlaylist(name)
      await addToPlaylist(playlist.playlistId, video)
      return { id: playlist.playlistId, name: playlist.title, count: 1, holds: true }
    },
  })
}
