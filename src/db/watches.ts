// The stores' change notices, which pages' resources reload on.

import { create_watch } from '@x-tech-laboratories/x-libs/web/watch'

export const subscriptions_watch = create_watch()
export const history_watch = create_watch()
export const playlists_watch = create_watch()
