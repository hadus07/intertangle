# 07 — File-tree sidebar with include/exclude

**Type:** AFK
**Stories:** — (net-new, beyond PRD stories 1–29)

## What to build

A VSCode-explorer-style sidebar docked left of the canvas: a file tree with a checkbox
on every row that scopes which files may appear on the canvas. The sidebar is both a
filter and a navigator (click a file to seed it).

**Surface & data**
- Checkboxes are a **canvas filter**, not a tree cosmetic. An unchecked file never renders
  as a card — including when reached via chip expansion.
- Tree is built from `Object.keys(graph.nodes)` only (local TS/JS already in `/graph`),
  folders synthesized by splitting project-relative paths. No new server endpoint, no
  filesystem walk — every row is something that can actually appear on the canvas.

**Tree component (hand-rolled, no tree library)**
- Native `<details>`/`<summary>` for folder expand/collapse (collapsed folders leave their
  children unrendered — keeps large trees cheap, no virtualization needed).
- Native `<input type="checkbox">`; the indeterminate state is set via a ref callback
  (`el.indeterminate = someButNotAllIncluded`).
- Full tree checkboxes: files and folders each toggle. Clicking an unchecked/indeterminate
  folder checks all descendants; clicking a fully-checked folder unchecks all.
- Row **label click seeds a card**, reusing `setExpanded(prev => new Set([...prev, path]))`.
  Clicking an excluded row is a no-op.

**Filter mechanics (non-destructive view-transform)**
- All files checked by default.
- `expanded` stays untouched; a separate `excluded: Set<string>` is threaded into
  `toReactFlow`, which drops excluded nodes and their dangling edges at layout time.
  Toggle off → cards vanish; toggle on → reappear unchanged.
- Chips show the **live included count**: `imports (n)` is
  `graph.forward[path].filter(p => !excluded.has(p)).length` (same for `reverse`).
  All-imports-excluded → `imports (0)`, dead chip (correct — nothing to pull in).
- Excluded files are also hidden from the `Cmd-K` palette (`FilePalette` takes `excluded`
  as a prop). One rule everywhere: excluded = not a seed source.

**Layout & dock**
- New dependency: **`react-resizable-panels`** (the only new dep in this feature).
- Root becomes `<PanelGroup direction="horizontal">`: tree
  `<Panel collapsible collapsedSize={0}>` + `<PanelResizeHandle>` + canvas `<Panel>`.
  `<ReactFlow>` moves off `width:100vw` to `flex:1`.
- Collapse via a persistent left-edge chevron toggle **and** `Cmd-B` (extend the existing
  `keydown` listener in `App.tsx` that already handles `Cmd-K`). Re-expand imperatively
  via the panel ref.

**Persistence**
- Exclusions persist to `localStorage["interweave:excluded:" + graph.root]` — project-keyed
  (collision-free across projects sharing a port), hydrated on load. No server changes;
  `graph.root` is already in the `/graph` payload.
- Panel width persists via a single global `autoSaveId` (a width preference is
  project-agnostic). This is the tool's first client-side persisted state — a deliberate,
  narrow departure from the per-run-snapshot stance; it does not touch the graph/edge model.

## Acceptance criteria

- [x] Sidebar renders a collapsible file tree from the graph's local files, folders nested. (manual-verify)
- [x] Every file and folder row has a checkbox; folders show indeterminate when partially included. (manual-verify)
- [x] Toggling a folder cascades to all descendant files. (manual-verify)
- [x] Unchecking a file/folder removes matching cards and their edges from the canvas live; re-checking restores them unchanged. (manual-verify)
- [x] An excluded file is skipped during chip expansion (never spawns a card). (manual-verify)
- [x] Chip counts reflect only included targets and update live as checkboxes toggle. (manual-verify)
- [x] Clicking a file label seeds it as a card; clicking an excluded label does nothing. (manual-verify)
- [x] Excluded files do not appear in the `Cmd-K` palette. (manual-verify)
- [x] Sidebar resizes by dragging the handle and collapses/expands via chevron and `Cmd-B`. (manual-verify)
- [x] Exclusions survive a reload under the same project and do not leak into a different project. (manual-verify)
- [x] `toReactFlow` seam: given an `excluded` set, excluded nodes and edges touching them are absent from the output; output stays deterministic and overlap-free. (test)

> Deviation: pinned `react-resizable-panels@^2` (not latest v4). v4 is a ground-up
> rewrite (`Group`/`Separator` + ref hooks) that dropped the `PanelGroup`/`PanelResizeHandle`/
> `autoSaveId`/imperative-collapse API this slice's design depends on. Tree builder lives in
> `web/src/treeBuilder.ts` (pure, unit-tested) separate from the `FileTree.tsx` component.

## Blocked by

- 01 — Walking skeleton
