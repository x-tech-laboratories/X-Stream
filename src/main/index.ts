// The desktop app's main process: one window on the React page, its data in the profile folder, and the calls the page
// cannot make itself.

import { app, BrowserWindow, ipcMain, nativeTheme, screen, shell } from 'electron'
import { join } from 'node:path'

import { create_main_fetch, create_main_stream_fetch } from '@x-tech-laboratories/x-libs/electron/fetch'
import { create_window } from '@x-tech-laboratories/x-libs/electron/window'

import { x_stream_bridge, x_stream_device_bridge, x_stream_events, YOUTUBE_HOSTS } from '../shared/bridge.ts'
import { freetube_read_data, freetube_scan } from './freetube.ts'
import { open_store } from './store.ts'

// ============================================================================
// Window
// ============================================================================

function open_main_window(): void {
  create_window(BrowserWindow, {
    title: 'X-Stream',
    icon: join(import.meta.dirname, '../../resources/icon.png'),
    file: join(import.meta.dirname, '../renderer/index.html'),
    dev_url: process.env.ELECTRON_RENDERER_URL,
    preload: join(import.meta.dirname, '../preload/index.cjs'),
    sandbox: true,
    default_size: { width: 1280, height: 800 },
    min_size: { width: 640, height: 480 },
    state_file: join(app.getPath('userData'), 'window.json'),
    native_theme: nativeTheme,
    shell,
    screen,
  })
}

// ============================================================================
// Start
// ============================================================================

const store = await open_store(app.getPath('userData'))

// A streamed body reaches the page chunk by chunk as events, so the player reads segments as they land.
const stream_fetch = create_main_stream_fetch({ hosts: YOUTUBE_HOSTS }, (chunk) => {
  x_stream_events.emit(BrowserWindow.getAllWindows(), 'stream_chunk', chunk)
})

x_stream_bridge.handle(ipcMain, {
  http_fetch: create_main_fetch({ hosts: YOUTUBE_HOSTS }),
  http_stream: stream_fetch.start,
  http_stream_cancel: stream_fetch.cancel,
  freetube_scan: () => freetube_scan(),
  freetube_read_data: (directory) => freetube_read_data(directory),
  ...store.methods,
})
x_stream_device_bridge.handle(ipcMain, store.device_methods)

void app.whenReady().then(() => {
  open_main_window()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open_main_window()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => store.close())
