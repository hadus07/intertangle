import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import graphPlugin from './plugins/graph.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), graphPlugin()],
  root: __dirname,
  base: './',
  resolve: {
    alias: {
      '~shared': path.resolve(__dirname, '../src/shared'),
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
})
