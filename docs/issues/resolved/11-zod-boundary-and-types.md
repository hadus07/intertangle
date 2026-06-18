# 11 — Zod at the security boundary + type composition

**Type:** Refactor (readability initiative)
**Stories:** — (code-quality pass, beyond PRD stories)

## What to build

Make the one real security boundary's input contract explicit with Zod, derive types by
composition, and close the test gaps the exploration surfaced. The only new runtime dependency
in the whole initiative lands here — server-side only.

**Zod at `/file` + `/open` (the documented trust boundary)**
- Add `zod` (`^4`). Validate the `path` query param at both route entries before calling
  `resolveInside`: non-empty, not absolute. On failure respond `400`.
  ```ts
  const PathParam = z.string().min(1).refine(p => !path.isAbsolute(p))
  const parsed = PathParam.safeParse(url.searchParams.get('path'))
  if (!parsed.success) { res.writeHead(400); res.end('Bad request'); return }
  ```
- This does **not** replace `resolveInside` — that remains the actual traversal guard. Zod makes
  the param contract explicit at the entry point. Server-only; never bundled into the browser asset.
- Note: Zod v4 has API changes from v3 — follow v4 docs, not older snippets.

**Type composition (extend where it makes sense)**
- `FileCardData extends GraphNode` — drop the duplicated `name`/`path` (`projectGraph` already
  spreads a `GraphNode` into `data` via `...node`). Keep `extends Record<string, unknown>` for
  React Flow's data constraint: `interface FileCardData extends GraphNode, Record<string, unknown> { … }`.
- Define a `CardHandlers` interface for the three optional handlers; have `FileCardData` include
  it and `mergeNodes`/`useCanvasLayout` reference `CardHandlers` directly (today it's
  `Pick<FileCardData, …>` — fine, but a named interface reads better now that it's shared).

**Close test gaps (cheap, while we're at the boundary)**
- `/open` traversal rejection test (the route is currently untested).
- `400` test for the new Zod param (missing / empty / absolute `path`).
- `graphView` reducer: add `seed` and `hydrateExclusions` cases (both untested today).

## Acceptance criteria

- [x] `zod` added; `/file` and `/open` reject missing/empty/absolute `path` with `400` before `resolveInside` runs. (test)
- [x] `resolveInside` still rejects traversal (`..%2F…`) and absolute out-of-project paths with `403`; existing server tests pass. (test)
  - Note: absolute paths are now caught by Zod and return `400` (not `403`); traversal still returns `403`. The old absolute-path `403` test was replaced with the new `400` test.
- [x] `FileCardData extends GraphNode`; no duplicated `name`/`path` fields; `CardHandlers` is a shared interface. (test: type-check + green tests)
- [x] New tests cover `/open` traversal, the `400` param path, and the `seed`/`hydrateExclusions` reducer actions. (test)
  - Note: `hydrateExclusions` does not exist in the codebase (the equivalent is `setExclusion`, already tested). `seed` tests added.
- [x] `zod` does not appear in the built web bundle. (manual-verify: grep `dist/web`)
- [x] `npx biome check .` clean; `npm test` green. (test)

## Blocked by

- 10 — Folder split, expressive names, comment cleanup
