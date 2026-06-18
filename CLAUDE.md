# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Slice 01 (walking skeleton) is in place. The package scaffold, core source modules,
Vite React frontend, fixtures, and seam tests now exist. Read before building:

- `docs/prd/prd-import-graph-explorer.md` — full design, implementation decisions, locked scaffold decisions, testing seams. Authoritative.
- `docs/issues/open/NN-*.md` — implementation slices; pick up at 02 once 01 lands.

## What intertangle is

A global CLI run inside any TS/JS project. It scans the project once with
dependency-cruiser, starts a local Node `http` server, and opens the browser to an
infinite React Flow canvas where files are cards you expand outward along import edges.
Fully local, read-only, no network calls off the machine.

## Architecture (the four modules that matter)

The whole tool is four units with clean seams — keep logic in these, not in glue:

- **`buildGraph`** (`src/`) — runs dependency-cruiser **once** over cwd, returns a normalized in-memory graph: local-file nodes, forward edges (imports), reverse edges (inverted forward = imported-by), per-node external labels (npm/core/unresolved). dependency-cruiser is configured to **not follow `node_modules`**. The graph is a **startup snapshot**; edges are never recomputed during a session.
- **HTTP server** (`src/`, Node built-in `http`) — serves prebuilt frontend assets plus two routes: `GET /graph` returns the normalized graph as JSON; `GET /file?path=<relative>` reads the file **live from disk** and returns **server-side Shiki-highlighted HTML**. The `/file` handler confines `path` to within the scanned project dir and rejects anything resolving outside it.
- **Shared graph contract + canvas transform** (`src/shared/`) — the graph type and two seams in `canvas.ts`: pure `projectGraph(graph, visible, excluded) → nodes/edges` (no positions, no elk), and async `layout(nodes, edges, sizes) → positioned nodes` (elk, dynamically imported). The frontend projects synchronously, then lays out once it has measured sizes.
- **Frontend** (`web/`, Vite + React + `@xyflow/react`) — the canvas. Custom node component per card. Carries **no** highlighting dependency; it injects the HTML `/file` returns. Layout re-runs on each expansion, anchoring new nodes near the expanded card.

Why a whole-project up-front scan: reverse edges ("imported by") can't be computed
lazily — you can't know who imports a file without indexing everything. This forces the
snapshot-at-startup architecture. Live `/file` reads keep source current; only *edges*
go stale (restart to refresh them).

## Hard constraints (do not simplify away)

- The `/file` **path-traversal guard** is the one real security boundary. Must be covered by a test. Never relax it.
- `node_modules` is never traversed; external packages render as **inert, non-expandable labels** only.
- Prebuilt assets ship in the package — **no build step at install or run time**. `files: ["dist"]`. Server resolves assets via `new URL('./web/', import.meta.url)`.

## Locked scaffold decisions (do not re-litigate)

- **Package manager:** npm, single package, no workspaces.
- **Module system:** ESM (`"type": "module"`), target ES2022 (Node ≥18), `moduleResolution` Bundler. One root `tsconfig.json` with a `web/` override for DOM libs.
- **Build:** Vite (frontend → `dist/web/`), tsup (CLI → `dist/cli.js`). Single `bin`: `intertangle`.
- **Lint/format:** Biome (`biome.json`). **Tests:** Vitest.
- **Deps:** runtime/build — `dependency-cruiser, @xyflow/react, elkjs, shiki, vite, tsup, open, cmdk`; dev — `vitest, @biomejs/biome, typescript`. Don't add a dependency for what a few lines can do.

## Testing approach

Assert external behavior at the highest seam; never test dependency-cruiser/Shiki/React
Flow/elkjs internals. Seams: `buildGraph` (graph shape against fixtures), HTTP API
(`/graph` JSON + `/file` highlight + traversal rejection), `projectGraph` (pure
nodes/edges, counts net of exclusion), `layout` (no overlaps, deterministic). Fixtures are real throwaway projects under
`test/fixtures/<case>/` (`relative-imports/`, `ts-aliases/`, `cycle/`, `external-deps/`).
Chip expansion, fuzzy palette, pan/zoom, and visual highlight correctness are manual in v1.

## Workflow conventions

- Conventional-commit prefixes (`feat:/fix:/chore:`) by habit, no enforcement.
- One slice per branch, named like the issue (`01-walking-skeleton`).
- Done-signal: `git mv docs/issues/open/NN.md docs/issues/resolved/NN.md` in the landing commit.
- After completing a code change, invoke the `sync-docs` skill (`/sync-docs`) to tick issue acceptance criteria, move resolved issues, and reflect any design deviation in the PRD.

## Commands

- `npm install` — install deps.
- `npm run build` — tsup CLI (`dist/cli.js`) then Vite web (`dist/web/`).
- `npm test` / `npx vitest run <file>` — run tests.
- `npx biome check .` / `npm run format` — lint / format.
- `node dist/cli.js <path> [...]` — run the built CLI locally (after `npm run build`).
