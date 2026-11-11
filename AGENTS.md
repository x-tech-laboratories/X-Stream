# X-Stream — instructions for AI agents

## Repo layout

```
X-Stream/
├── src/             React UI — the app itself (the page in the Electron window)
├── src/main/        Electron main process: the window, YouTube requests, FreeTube import
├── src/preload/     Puts the main process's methods on the page as window.x_stream
├── src/shared/      The bridge's method table, shared by main, preload and page
├── resources/       The app's icons
└── shell.nix        Nix dev shell (Node 24, Electron, git)
```

Full architecture and roadmap are in [DEVELOP.md](DEVELOP.md).

## Dev environment

All development happens inside the Nix shell. Enter it once at the start of a session:

```bash
nix-shell   # provides Node 24, npm, Electron, git
```

- **Install libraries here** — never `npm install` outside the shell
- **Run all build, test, and run commands from inside the shell**
- To add a new tool to the environment, add it to `shell.nix` and re-enter the shell

## Running things

```bash
# Desktop app — this is the whole app
npm run dev
```

## React UI (`src/`) + Electron (`src/main/`, `src/preload/`)

- `src/` is the app; it runs as the page in the Electron window, built by electron-vite (`electron.vite.config.ts`)
- **Routing**: React Router 7 with a hash router, since the built page loads from a file — routes in `src/App.tsx`; `Layout` wraps the tab pages, `/watch/:videoId` and `/channel/:channelId` render inside it
- **Widgets and look**: pages are drawn with X-Libs' React widgets (`Shell`, `MediaTile`, `MenuButton`, `Segmented`, `Switch`, `use_resource`, `confirm_dialog`, …) on Halon's stylesheets, imported once in `src/main.tsx`; the app's own CSS holds only layout and player rules on Halon's tokens, never raw colours
- **Theme**: `src/theme.ts` is X-Libs' `theme_choice`, kept in the settings and mirrored in this browser
- **Pages**: `src/pages/<Name>/` (Search, Watch, Channel, Subscriptions, Channels, History, Settings). There is no Home page — `/` redirects to the user's configured startup page.
- **Data layer**: PouchDB (browser) via `src/db/`; the plugin system (`src/plugins/`, X-Libs' plugin host with the youtubejs plugin bundled, each plugin providing a `video_source`) fetches YouTube data
- **Desktop-only features** (e.g. FreeTube import) run in the main process (`src/main/`), are listed in the bridge table in `src/shared/bridge.ts` (X-Libs `define_bridge`), wrapped in `src/utils/desktop.ts`, and guarded with `is_desktop()` in the page
- The window comes from X-Libs `create_window`: links and other sites open in the browser, and its size and place are kept in `window.json` in the app's data folder

### The fetch shim — read before touching networking

youtubei.js runs *in the page*, so YouTube requests would normally hit CORS. They are
sent from the main process instead (X-Libs `electron/fetch`) via `Innertube.create({ fetch })`.
`desktop_fetch` brings the whole body back in one bridge reply; `desktop_stream_fetch` opens
`http_stream` and gets the body as `stream_chunk` events (`x_stream_events`), so a
`ReadableStream` body reaches the player as it arrives.
Two non-obvious rules, both enforced by `tests/desktop_fetch.test.ts`:

- **Pin `Origin`/`Referer` to `https://www.youtube.com`.** InnerTube returns `403` for any
  cross-origin value, including an empty one.
- **New outbound hosts** must be added to `YOUTUBE_HOSTS` in `src/shared/bridge.ts`; the
  main process refuses everything else, since the page also runs YouTube's BotGuard script.

Adding a native command: write it in `src/main/`, add it to `XStreamApi` and the method
list in `src/shared/bridge.ts`, answer it in `src/main/index.ts`, then wrap it in
`src/utils/desktop.ts`.

### Performance — the rules that keep pages fast

Three constraints, each of which was a real regression:

- **Never refetch a fresh cache.** Channel caches carry `fetchedAt`; use
  `getStaleChannelIds()` before refreshing. Refreshing everything on mount made the
  subscriptions feed take ~8s to settle.
- **The page sends no `Referer`.** `index.html` sets `<meta name="referrer" content="no-referrer">`:
  Google's image hosts (`yt3.googleusercontent.com`, `yt3.ggpht.com`) answer `429` to a foreign
  Referer, which broke avatars and banners in dev.
- **Never store images as base64.** Thumbnails are URLs rendered by
  `<img loading="lazy">`. Inlining them cost hundreds of requests per refresh and
  produced a ~75 MB PouchDB that slowed every read. Channel *avatars* are the one
  exception — few, small, and shown on every page.
- **Paginate long lists.** Channel and History grids render in chunks with X-Libs'
  `use_reveal`.

### Video playback — why it isn't just `<video src>`

YouTube stops muxing video+audio at **360p**; every higher quality is an adaptive
(video-only) stream that must be combined with a separate audio stream via MSE. The
player (`src/components/SabrPlayer/`) streams over SABR with shaka-player and
googlevideo's adapter:

- **Use the `IOS` Innertube client.** It's the only one whose stream URLs need no
  signature deciphering; WEB/ANDROID/TV require a JS evaluator we don't ship.
- Segment requests go through `desktop_stream_fetch` (`src/services/shakaAdapter.ts`), since
  `googlevideo.com` sends no `Access-Control-Allow-Origin`; the UMP decoder reads the
  streamed body chunk by chunk, the way it would a browser fetch.
- BotGuard (`src/services/botguard.ts`) mints the proof-of-origin token by running
  YouTube's script in the page, which is why the CSP in `index.html` allows `'unsafe-eval'`.

### youtubei.js payload repairs

`repairYouTubePayload` in `src/utils/desktop.ts` patches responses in transit to
work around live schema changes that youtubei.js 17.2.0 cannot parse — currently
a missing `commentEntityPayload.avatar` (which throws for the whole response) and
comment replies moving to `subThreads`. Check whether upstream has caught up
before adding more, and delete the repairs once it has.

Adding a page: create `src/pages/<Name>/<Name>.tsx` (+ `.css`, `index.ts`), then add a `<Route>` in `src/App.tsx`.

## Commands

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Tests | `npm test` |
| Type-check | `npm run typecheck` |
| Desktop dev | `npm run dev` |
| Desktop build | `npm run build` (into `out/`), then `npm start` |

## Conventions

- TypeScript strict mode everywhere; no `any` unless unavoidable and documented
- React: pages live in `src/pages/<Name>/`, shared UI in `src/components/<Name>/`; each folder has an `index.ts` re-export
- PouchDB document IDs use a typed prefix: `sub-<channelId>`, `history-<videoId>`, `settings`, `channel-cache-<channelId>`

## Documentation

Keep documentation in sync with every code change:

- **`AGENTS.md`** — update whenever commands, conventions, or project structure change
- **`DEVELOP.md`** — update the relevant section when adding or removing a significant capability; tick roadmap checkboxes as items complete

Do not create separate design or decision documents — use the conversation and `DEVELOP.md` instead.

## Tests

Run the relevant suite before committing:

```bash
# Vitest: the files covering what changed
npx vitest run tests/<file>.test.ts
```

All tests must pass before committing. If a test suite doesn't exist for the changed area, note it explicitly.

## Committing

1. **Run tests** for the changed area (see above).
2. **Update docs** — tick roadmap items, update DEVELOP.md, update AGENTS.md if conventions changed.
3. **Stage precisely** — add specific files, not `git add .`; never stage `.env`, secrets, or build artefacts.
4. **Commit message format** — [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
   - First line: `<type>[scope]: <short imperative summary>` (≤ 72 chars), e.g. `fix(player): ...`
   - Body (optional): explain *why*, not *what*
   - End with an `Assisted-by:` trailer naming the AI tool used, e.g. `Assisted-by: Claude Code`
5. **One logical change per commit** — don't bundle unrelated fixes.
6. **Land through a pull request.** `main` is protected; CI must pass before merging.

## Response style

- Be concise. One sentence per update while working; one or two sentences at the end summarising what changed and what's next.
- No preamble ("Sure!", "Great question!", "I'll now…"). Start with the action.
- No trailing summaries restating what the diff already shows.
- Prefer a direct answer over a list of options when the right answer is clear.
- Skip comments that explain *what* code does — only add them when the *why* is non-obvious.

## X-Tech standards

- Follow the [Application Standard](https://x-tech-laboratories.github.io/standards/application/) and the
  [Design Guidelines](https://x-tech-laboratories.github.io/standards/design/), whose source is `src/content/docs/standards/`
  in [x-tech-laboratories.github.io](https://github.com/x-tech-laboratories/x-tech-laboratories.github.io). Ask before
  changing either, since a change applies to every X-app.
- Use [X-Libs](https://github.com/x-tech-laboratories/X-Libs) and Halon ([X-Themes](https://github.com/x-tech-laboratories/X-Themes))
  before writing your own code: check the module table in the X-Libs README first.
- A feature another app could use belongs in X-Libs, or Halon for styling, with tests and a README row. If that is out
  of reach, add it to the candidates in X-Libs' `docs/TODO.md`.
