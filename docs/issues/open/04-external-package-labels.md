# 04 — External packages as inert labels

**Type:** AFK
**Stories:** 20, 21

## What to build

Show a file's outside dependencies on its card without letting the graph expand into
`node_modules`.

- `buildGraph` tags each dependency by type (npm / core / unresolved) using
  dependency-cruiser's classification, and attaches the external ones as **labels** on
  the importing node.
- Cards render external dependencies as inert label chips (e.g. `react`, `lodash`, `fs`).
- External labels are not graph nodes and have no expansion affordance.
- `doNotFollow` keeps `node_modules` out of the scan.

## Acceptance criteria

- [ ] A card lists the external/npm/core packages its file imports as labels.
- [ ] External labels are visually distinct from local cards and cannot be expanded.
- [ ] External packages never appear as their own cards on the canvas.
- [ ] `buildGraph` seam: externals are attached to the importing node as labels, not emitted as nodes; `node_modules` is not traversed.

## Blocked by

- 01 — Walking skeleton
