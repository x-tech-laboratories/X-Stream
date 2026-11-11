// Puts the main process's methods on the page's window as window.x_stream and window.x_stream_device, and its events
// as window.x_stream_events.

import { contextBridge, ipcRenderer } from 'electron'

import { x_stream_bridge, x_stream_device_bridge, x_stream_events } from '../shared/bridge.ts'

x_stream_bridge.expose(contextBridge, ipcRenderer)
x_stream_device_bridge.expose(contextBridge, ipcRenderer)
x_stream_events.expose(contextBridge, ipcRenderer)
