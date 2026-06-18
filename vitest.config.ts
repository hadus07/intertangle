import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // process.chdir is required to verify buildGraph works when cwd differs from
    // the scanned root; vitest's default worker pool does not allow chdir.
    poolMatchGlobs: [['**/buildGraph.test.ts', 'forks']],
  },
})
