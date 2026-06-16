# 01 — Walking skeleton: CLI scans project, browser renders seed cards

**Type:** AFK
**Stories:** 1, 2, 3, 6, 7, 8, 25, 28, 29

## What to build

The thinnest end-to-end path through every layer. Running the CLI with one or more
file-path arguments inside a TS/JS project scans the project once, starts a local HTTP
server, opens the browser, and renders the seed files as folded cards on an infinite
canvas.

- CLI (`bin`) accepts optional file-path arguments.
- `buildGraph` runs dependency-cruiser once over the current working directory and
  returns a normalized graph of local-file nodes with **forward edges** from relative
  imports. (Alias resolution and reverse edges come in later slices.)
- A Node `http` server serves the prebuilt React Flow frontend and `GET /graph`
  (normalized graph as JSON).
- The browser opens automatically (`open` package) to an infinite, pannable/zoomable
  React Flow canvas.
- Seed files passed as CLI args render as **folded cards** showing filename and
  project-relative path.
- Ctrl-C shuts the server down and frees the port.
- Everything runs locally; nothing leaves the machine.

This establishes the package shape that every later slice builds on (see PRD →
Scaffold Decisions for the full rationale):

- **npm**, single package, ESM (`"type": "module"`, ES2022, `moduleResolution` Bundler).
- Layout: `src/` (CLI + server + `buildGraph` + `toReactFlow`, tsup → `dist/cli.js`),
  `web/` (Vite React app → `dist/web/`). Publish `files: ["dist"]`; bin is `dist/cli.js`.
- Server serves prebuilt assets from `new URL('./web/', import.meta.url)`.
- **Biome** for lint/format; **Vitest** for tests with fixtures under `test/fixtures/`.

## Acceptance criteria

- [x] `interweave <file> [...]` run in a TS/JS project opens the browser to the canvas. (manual-verify)
- [x] Each seed file appears as a folded card with its name and project-relative path. (manual-verify)
- [x] The canvas can be panned and zoomed. (manual-verify)
- [x] `GET /graph` returns local-file nodes and forward edges (relative imports) for a fixture project — verified against the `buildGraph` seam.
- [x] `node_modules` is not traversed.
- [x] Ctrl-C stops the process and frees the port. (manual-verify)
- [x] Frontend assets are served from the prebuilt bundle (no build step at run time).

## Blocked by

None - can start immediately.
