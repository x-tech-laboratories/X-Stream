# X-Stream

[![AI readiness](https://img.shields.io/endpoint?url=https://x-tech-laboratories.github.io/badges/x-tech-laboratories/X-Stream.json)](https://x-tech-laboratories.github.io/guidelines/readiness/)

<a href="https://liberapay.com/BeatLink/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"></a> <a href="https://ko-fi.com/I4V52ANK6N"><img alt="Support me on Ko-fi" src="https://ko-fi.com/img/githubbutton_sm.svg"></a>

A free, open source, privacy-respecting YouTube client.

X-Stream lets you browse and watch YouTube content without being tracked by Google. Your data lives on your device, with no account and no server of ours involved.

## Platforms

| Platform | How |
|----------|-----|
| Desktop | Electron (Linux / macOS / Windows) |
| Mobile | React Native — planned |

## Your data

Subscriptions, playlists, watch history and settings are kept in `x-stream.db` in the app's profile folder
(`~/.config/x-stream` on Linux), and copies of YouTube's channel and video details in `cache.db` beside it. The first
start of this version brings over the copy earlier versions kept in the window's own storage, and leaves that copy where
it was.

`x-stream.db` is backed up once a day into `backups` beside it, keeping the last 14; Settings → Backups backs up by
hand, changes that, and restores a backup, backing up the current data first. `cache.db` is not backed up, since it is
fetched again.

Every change to a playlist of your own is kept: History on the playlist goes back to an earlier version, and Changes on
the Playlists page brings back a deleted playlist. Older versions go after 90 days, which Settings → Playlist history
changes. The watch history is a log of what was watched rather than something edited, and a subscription or a
subscribed playlist is only followed, not edited, so neither has a history of its own.

X-Stream has no server, so nothing syncs between devices.

## Development

X-Stream uses a [Nix](https://nixos.org/) dev environment for reproducible builds.

```bash
nix develop        # or nix-shell: Node 24 and Electron
npm install
npm run dev        # the desktop app, reloading as the code changes
npm run build      # type-checks, then builds into out/
npm start          # runs the built app
npm test           # one pass of the tests
npm run lint
```

## Project structure

See [DEVELOP.md](DEVELOP.md) for the full architecture, tech stack, and roadmap.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
