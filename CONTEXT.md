# intertangle

Domain language for intertangle — a local CLI that scans a TS/JS project's import
graph and renders it as an infinite canvas of file cards you expand along edges.

## Language

**Graph**:
The startup snapshot of the project: local-file nodes, forward edges (imports),
reverse edges (imported-by), and per-node external labels. Built once, never
recomputed during a session.

**Graph view**:
The user's current view state over the [Graph](#graph) — the visible set, the
exclusions, and the open source file. A pure model: `graphView(graph, state,
action) → state`, adapted to React by `useGraphView(graph)`.
_Avoid_: canvas state, view model.

**Visible set**:
The paths currently shown as cards (`expanded`). Membership only — independent
of exclusion. Consumed by `projectGraph(graph, visible)`.
_Avoid_: open files, shown nodes.

**Exclusion**:
A render-time filter (`excluded`) that hides nodes and their edges without
removing them from the [visible set](#visible-set). Persisted per project.
_Avoid_: hidden, filtered-out.

**Card**:
A file rendered on the canvas, with imports / imported-by chips that expand the
[visible set](#visible-set) outward.
_Avoid_: node (reserved for the graph), tile.

**External label**:
An inert, non-expandable marker for an npm / core / unresolved dependency.
`node_modules` is never traversed, so externals never become [cards](#card).
