# PRD: interweave

A global terminal utility that scans a TS/JS project once, opens a browser with an
infinite canvas, and lets you explore the import/export graph by expanding file cards
outward.

## Problem Statement

When I open an unfamiliar TS/JS codebase, I have no fast way to *see* how files relate.
I read one file, find an import, jump to it, lose my place, open another, and rebuild
the dependency picture in my head every time. Tools that draw whole-project dependency
graphs dump thousands of nodes at once — unreadable — or show edges without the actual
code, so I still have to context-switch back to the editor to understand what a
connection means. I want to start from the files I care about and pull in only the
related files, on demand, with the relevant source visible right there.

## Solution

A CLI I install globally and run inside any TS/JS project. It scans the project once,
then opens a browser showing an infinite, pannable canvas. I seed the canvas with one
or more files (CLI args or an in-browser fuzzy search). Each file is a **card**, folded
by default, showing its name, path, and two expansion chips: `imports (n) ▸` and
`imported by (m) ◂`. Clicking a chip reveals those related files as new cards, placed
automatically with no overlaps, growing outward from the card I clicked. Any card can be
expanded to show its full source with syntax highlighting. External packages
(`node_modules`, node core) appear as inert labels on the card — they show the boundary
but never spawn cards. I explore the graph the way I think about it: starting from what
matters and following dependencies in either direction, with the code in front of me.

## User Stories

1. As a developer, I want to install the tool globally via npm, so that I can run it in any project without per-project setup.
2. As a developer, I want to run a single command inside a project directory, so that I can start exploring without configuration.
3. As a developer, I want to pass one or more file paths as CLI arguments, so that those files open as my initial cards.
4. As a developer, I want to run the tool with no arguments and get an empty canvas with a fuzzy file-search palette, so that I can pick my starting file interactively.
5. As a developer, I want a `Cmd-K`-style fuzzy search available at any time, so that I can add additional root cards after I've started.
6. As a developer, I want the tool to open my browser automatically, so that I don't have to copy a URL.
7. As a developer, I want each file represented as a card folded by default, so that the canvas stays readable.
8. As a developer, I want a folded card to show the filename and project-relative path, so that I can identify it at a glance.
9. As a developer, I want a folded card to show an `imports (n)` chip, so that I can see how many local files it depends on and expand them.
10. As a developer, I want a folded card to show an `imported by (m)` chip, so that I can see how many local files depend on it and expand them.
11. As a developer, I want to click the `imports` chip to reveal the files a card imports from, so that I can follow dependencies forward.
12. As a developer, I want to click the `imported by` chip to reveal the files that import a card, so that I can follow dependencies in reverse.
13. As a developer, I want expansion to work while a card is still folded, so that I don't have to read code to navigate.
14. As a developer, I want newly revealed cards placed automatically without overlapping existing cards, so that I never have to arrange them manually.
15. As a developer, I want new cards positioned near the card I expanded from, so that the canvas grows outward and I keep my bearings.
16. As a developer, I want to expand a card to see its full source code, so that I can understand what a file does without leaving the canvas.
17. As a developer, I want expanded source to be syntax-highlighted with editor-grade fidelity, so that TS/JS reads naturally.
18. As a developer, I want expanded source shown in a scrollable, height-capped box, so that a large file doesn't blow up the card.
19. As a developer, I want the displayed source to reflect the file's current contents on disk, so that what I read is never stale even if I edited it after starting the tool.
20. As a developer, I want external/npm/core imports shown as inert labels on the card, so that I can see a file's outside dependencies without the graph exploding into node_modules.
21. As a developer, I want external labels to be non-expandable, so that exploration stays scoped to my own code.
22. As a developer, I want the tool to resolve TypeScript path aliases automatically from my root tsconfig, so that aliased imports connect to the right files.
23. As a developer, I want to override the tsconfig location with a flag, so that monorepos or non-root configs still resolve correctly.
24. As a developer in a project with no tsconfig, I want relative imports to still resolve, so that plain JS projects work.
25. As a developer, I want to pan and zoom the infinite canvas, so that I can navigate graphs larger than the viewport.
26. As a developer with a project that contains import cycles, I want the layout to handle them without breaking, so that circular dependencies still render.
27. As a developer, I want a file that's already on the canvas to be reused (not duplicated) when reached via another card's expansion, so that each file appears once and shared dependencies converge.
28. As a developer, I want the tool to run entirely on my machine with no data leaving it, so that I can use it on private code.
29. As a developer, I want to stop the tool and free the port when I'm done, so that it doesn't linger.

## Implementation Decisions

**Distribution & runtime**
- Single npm package, installable globally, exposing one `bin` CLI.
- The package ships **prebuilt** frontend assets so there is no build step at install or run time.
- On run, the CLI: (1) scans the current working directory to build the graph, (2) starts a small local HTTP server, (3) opens the default browser at the server URL.
- The server stays alive for the session; stopping the process frees the port.
- This is a fully local tool — no network calls off the machine.

**Project scan & graph (the `buildGraph` module)**
- Use **dependency-cruiser** to perform a single up-front scan that parses TS/JS, resolves module specifiers, and reads tsconfig `paths`/aliases.
- dependency-cruiser is configured to **not follow** `node_modules`.
- The module returns a normalized in-memory graph: local-file **nodes**, **forward edges** (imports), **reverse edges** computed by inverting the forward edges (imported-by), and per-node **external labels** (dependencies tagged by dependency-cruiser as npm/core/unresolved).
- The graph is a **snapshot** taken at startup; edges are not re-computed during the session.
- tsconfig resolution: default to the root `tsconfig.json`; a `--tsconfig <path>` flag overrides; if none is found, only relative imports resolve.

**HTTP server (two routes plus static assets)**
- Serves the prebuilt frontend assets.
- `GET /graph` → the full normalized graph snapshot as JSON (nodes, forward edges, reverse edges, external labels).
- `GET /file?path=<relative>` → reads the requested source file **live** from disk and returns it **server-side syntax-highlighted** as HTML.
- The `/file` route confines `path` to within the scanned project directory; requests that resolve outside it are rejected (path-traversal guard — trust boundary).

**Syntax highlighting**
- Use **Shiki** (TextMate grammars/themes) on the server, inside the `/file` handler, with a single shared highlighter instance. The frontend injects the returned HTML and carries no highlighting dependency.

**Frontend canvas**
- React app built with **Vite**, rendered in the browser.
- **React Flow (`@xyflow/react`)** provides the infinite canvas, pan/zoom, edges, and custom node rendering; each card is a custom React node component.
- Auto-layout via **elkjs**. Newly revealed nodes are anchored near the card they were expanded from. Layout re-runs on each expansion.
- A pure transform (the `toReactFlow` module) maps `(graph, expandedSet)` → positioned React Flow nodes and edges, keeping layout/transform logic independent of rendering.
- Node identity is the file's project path, so a file reached from multiple cards converges to a single node rather than duplicating.

**Card behavior**
- Folded (default): filename, project-relative path, `imports (n) ▸` and `imported by (m) ◂` chips, inert external-package labels.
- Expanded: whole-file source, Shiki-highlighted, in a fixed max-height scrollable box.
- Expansion is **chip-driven** for v1 ("expand by some other means"); clicking the literal import line inside the code is explicitly deferred.

**Seeding**
- CLI accepts optional file-path arguments that become the initial cards.
- With no arguments, the canvas opens empty with a fuzzy file-search palette (the full file list comes from the graph). The same palette adds further root cards mid-session.
- No entry-point guessing from `package.json` or elsewhere.

**Build tooling**
- Frontend: Vite. CLI: tsup. Browser launch: the `open` package. Server: Node's built-in `http`.

## Testing Decisions

Tests assert **external behavior at the highest available seam**, never implementation
details. We do not test dependency-cruiser, Shiki, React Flow, or elkjs internals — we
test the contracts of the modules we build on top of them, using small fixture projects
as inputs.

**Seam 1 — `buildGraph` (primary value).**
Run against committed fixture projects and assert the shape of the returned normalized
graph:
- A project with relative imports produces the expected forward edges.
- Reverse edges correctly invert the forward edges (imported-by).
- A project with tsconfig `paths` aliases resolves aliased imports to the right files.
- External/npm/core imports appear as labels on the importing node, never as graph nodes, and `node_modules` is not traversed.
- A project containing an import cycle produces a graph (no crash, both edges present).

**Seam 2 — HTTP API.**
Boot the server against a fixture project and assert responses:
- `GET /graph` returns the same normalized graph contract as Seam 1, as JSON.
- `GET /file?path=<valid>` returns highlighted HTML for an in-project file.
- `GET /file?path=<../escape>` (and absolute paths outside the project) is rejected — the path-traversal guard is a security test at a trust boundary and must be covered.

**Seam 3 — `toReactFlow` transform.**
Pure function, no browser:
- Given a graph and a set of expanded node ids, returns the expected nodes and edges.
- Produced positions have no overlapping cards.
- Output is deterministic for the same input.

**Prior art:** none yet — this is a greenfield project, so these seams establish the
testing conventions. Fixtures are minimal throwaway TS/JS projects checked into the
test directory. No test framework opinion is encoded here beyond "assert behavior on
fixtures"; choose the standard runner for the package.

**Manual / out of automated scope:** chip-click expansion, fuzzy-search palette, pan/zoom,
and the visual correctness of highlighted code are verified by running the tool, not by
automated browser tests in v1.

## Out of Scope

- **Clickable import lines inside the rendered code** ("A" in the design discussion). Requires TS-parser source positions for each import/export specifier plus Shiki decorations layered over the highlighted HTML. Deferred; chip-driven expansion delivers the full exploration experience first.
- **Live file watching / auto re-scan.** The graph is a startup snapshot. Since source is read live per request, only changed *edges* require a restart. A manual rescan button, then a chokidar watcher, are the staged upgrades if editing-while-open becomes a real workflow.
- **Region / signature views** (showing only the import/export region of a file). Whole-file scroll box only.
- **Layout persistence** across sessions — *partially relaxed by slice 07*: sidebar panel width
  (global `autoSaveId`) and per-project file exclusions (`localStorage["interweave:excluded:"+root]`)
  now persist client-side. This is the tool's first client-side persisted state; it does not touch
  the graph/edge snapshot model. Canvas node positions are still not persisted.
- **Multi-tsconfig merging** for complex monorepos. Single root tsconfig or explicit `--tsconfig` flag only.
- **Languages other than TS/JS.**
- **Traversing into `node_modules`** or rendering external packages as expandable nodes.
- **Editing code** from the canvas — read-only.

## Scaffold Decisions (locked)

Settled at scaffold time; do not re-litigate.

- **Package manager:** npm (`package-lock.json`). No workspaces — single package.
- **Repo layout:** `src/` (CLI + server + `buildGraph` + `toReactFlow`, built by tsup → `dist/cli.js`) and `web/` (Vite React app → `dist/web/`). Published via `files: ["dist"]`. Server resolves frontend assets with `new URL('./web/', import.meta.url)`.
- **Module system:** ESM (`"type": "module"`), `target` ES2022 (Node ≥18), `module` ESNext, `moduleResolution` Bundler. One root `tsconfig.json` with a `web/` override for DOM libs.
- **Lint/format:** Biome (single `biome.json`).
- **Test runner:** Vitest. Fixtures are real throwaway projects under `test/fixtures/<case>/` (`relative-imports/`, `ts-aliases/`, `cycle/`, `external-deps/`); seam tests in `test/*.test.ts`.
- **Fuzzy palette:** `cmdk` (provides the full Cmd-K modal, ranked list, and keyboard nav).
- **CLI name:** single bin `interweave`. No alias (add later if wanted).
- **Conventions:** conventional-commit prefixes (`feat:/fix:/chore:`) by habit, no enforcement tooling. Land each slice on a branch named like `01-walking-skeleton`; `git mv` the issue `docs/issues/open/NN.md` → `docs/issues/resolved/NN.md` in the landing commit as the done-signal.

Full dependency set: runtime/build — `dependency-cruiser, @xyflow/react, elkjs, shiki, vite, tsup, open, cmdk`; dev — `vitest, @biomejs/biome, typescript`. Server is Node's built-in `http`. No new dependency is added for what a few lines can do.

## Further Notes

- The reverse-dependency requirement ("imported by") is what forces the single up-front whole-project scan; it cannot be done lazily because there is no way to know who imports a file without indexing everything. This is the justification for the snapshot-at-startup architecture.
- Expanded card source is always current because `/file` reads from disk on demand; the only thing the snapshot can go stale on is the set of edges.
- The `/file` path-traversal guard is the one hard security boundary in an otherwise local, read-only tool and must not be simplified away.
- CLI command name finalized as a single `interweave` bin (no alias). See Scaffold Decisions.
