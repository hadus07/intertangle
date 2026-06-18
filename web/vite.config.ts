import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } })],
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
    // ponytail: elkjs is a GWT blob (~1.4MB, un-tree-shakeable) but lazy-loaded
    // in its own chunk via dynamic import — raise the limit past it, not global.
    chunkSizeWarningLimit: 1500,
  },
})
