# X-Stream

[![AI readiness](https://img.shields.io/endpoint?url=https://x-tech-laboratories.github.io/badges/x-tech-laboratories/X-Stream.json)](https://x-tech-laboratories.github.io/guidelines/readiness/)

A free, open source, privacy-respecting YouTube client.

X-Stream lets you browse and watch YouTube content without being tracked by Google. It is fully peer-to-peer — your data lives on your device and syncs directly with your other devices, with no central server involved.

## Platforms

| Platform | How |
|----------|-----|
| Desktop | Electron (Linux / macOS / Windows) |
| Mobile | React Native — planned |

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
