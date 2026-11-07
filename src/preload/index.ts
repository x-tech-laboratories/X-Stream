// Puts the main process's methods on the page's window as window.x_stream.

import { contextBridge, ipcRenderer } from 'electron'

import { x_stream_bridge } from '../shared/bridge.ts'

x_stream_bridge.expose(contextBridge, ipcRenderer)
