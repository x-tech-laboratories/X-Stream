import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rolldownOptions: { input: { index: resolve('src/main/index.ts') } },
    },
  },
  preload: {
    build: {
      // A sandboxed preload is one CommonJS file, so X-Libs is bundled into it.
      externalizeDeps: { exclude: ['@x-tech-laboratories/x-libs'] },
      rolldownOptions: {
        input: { index: resolve('src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        // PouchDB needs Node's events module in the page.
        events: 'events',
      },
    },
    optimizeDeps: {
      include: ['pouchdb-browser'],
    },
    build: {
      rolldownOptions: { input: { index: resolve('index.html') } },
    },
  },
})
