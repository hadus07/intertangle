# 02 — Chip-driven expansion + auto-layout

**Type:** AFK
**Stories:** 9, 10, 11, 12, 13, 14, 15, 26, 27

## What to build

Turn the static seed canvas into an explorable graph. Each folded card gains two
expansion chips driven by the graph's edges; clicking a chip reveals the related files
as new cards, placed automatically with no overlaps.

- `buildGraph` adds **reverse edges** by inverting the forward edges (imported-by).
- Folded cards show `imports (n) ▸` and `imported by (m) ◂` chips with live counts.
- Clicking `imports` reveals the files the card imports from; clicking `imported by`
  reveals the files that import it.
- Expansion works while the card is folded (no need to open the code).
- A pure `toReactFlow(graph, expandedSet)` transform maps the visible set to positioned
  React Flow nodes/edges; **elkjs** computes the layout.
- Newly revealed cards are anchored near the card they expanded from; layout re-runs on
  each expansion; no cards overlap.
- Node identity is the file's project path: a file reached from multiple cards converges
  to a single node rather than duplicating.
- Import cycles render without breaking.

## Acceptance criteria

- [ ] Folded cards display accurate `imports` and `imported by` counts.
- [ ] Clicking `imports` adds the forward-dependency cards to the canvas.
- [ ] Clicking `imported by` adds the reverse-dependency cards to the canvas.
- [ ] Expansion works on a folded card without expanding its source.
- [ ] New cards appear near their parent and never overlap existing cards.
- [ ] A file already on the canvas is reused, not duplicated, when reached again.
- [ ] A fixture project with an import cycle renders without crashing.
- [ ] `toReactFlow` seam: given a graph + expanded set, returns expected nodes/edges, no overlapping positions, deterministic output.

## Blocked by

- 01 — Walking skeleton
