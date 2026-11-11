import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@x-tech-laboratories/halon/halon-tokens.css'
import '@x-tech-laboratories/halon/halon.css'
import 'shaka-player/dist/controls.css'
import App from './App.tsx'
import { pluginManager, startPlugins } from './plugins/manager'
import { getSettings, stripInlinedThumbnails } from './db/index'
import { import_browser_storage } from './db/browser_import'
import { startRefresher } from './services/refresher'
import { load_saved_theme } from './theme'

// The first start after the data moved into the desktop app brings the page's old copy over before anything reads it.
await import_browser_storage().catch((error: unknown) => console.error('Could not bring over the old data', error))

void load_saved_theme()

// Reclaim space from the old base64-thumbnail scheme. Runs in the background:
// nothing on screen depends on it, and it no-ops once the data is clean.
stripInlinedThumbnails().catch(() => {})

// Keeps cached channel/video metadata warm. Starts after a delay and works in
// small batches, so it never competes with what the user is actually loading.
startRefresher()

// Pages ask for the active source as they mount, so they draw once the plugins have started.
void startPlugins().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // Restore the saved source, falling back to auto-select
  getSettings()
    .then(settings => {
      try {
        pluginManager.setActive(settings.activePlugin)
      } catch {
        pluginManager.autoSelect().catch(() => {})
      }
    })
    .catch(() => pluginManager.autoSelect().catch(() => {}))
})
