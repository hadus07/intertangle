# 05 — tsconfig alias resolution + `--tsconfig` flag

**Type:** AFK
**Stories:** 22, 23, 24

## What to build

Resolve TypeScript path aliases so aliased imports connect to the right files, with an
override for non-standard layouts and a graceful fallback when no config exists.

- `buildGraph` feeds the root `tsconfig.json` to dependency-cruiser so `paths` aliases
  (e.g. `@/foo`) resolve to their target files.
- A `--tsconfig <path>` CLI flag overrides which config is used (monorepos, non-root
  configs).
- When no tsconfig is found, the scan still runs and resolves relative imports only;
  aliases simply don't resolve.

## Acceptance criteria

- [x] In a fixture project with `paths` aliases, aliased imports produce edges to the correct target files.
- [x] `--tsconfig <path>` causes resolution to use the specified config.
- [x] A project with no tsconfig still produces a graph from relative imports without error.
- [x] `buildGraph` seam covers all three cases (root config, flag override, no config).

## Implementation note

`dep-cruiser`'s native `tsConfig.fileName` option fails to resolve aliases when `baseDir` ≠ CWD (the `tsconfig-paths-webpack-plugin` it uses resolves relative to CWD). Paths are instead extracted manually from the tsconfig JSON and passed as `enhancedResolveOptions.alias` — supported at runtime, absent from dep-cruiser's TypeScript types (cast used).

## Blocked by

- 01 — Walking skeleton
