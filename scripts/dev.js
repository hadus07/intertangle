import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const vite = spawn('npm', ['run', 'dev:web'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    INTERWEAVE_ROOT: targetDir,
  },
})

process.on('SIGINT', () => vite.kill('SIGTERM'))
process.on('SIGTERM', () => vite.kill('SIGTERM'))
