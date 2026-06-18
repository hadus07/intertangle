# 10 — Folder split, expressive names, comment cleanup

**Type:** Refactor (readability initiative)
**Stories:** — (code-quality pass, beyond PRD stories)

## What to build

The pure-readability pass: organize `web/src`, sharpen names, and delete what-comments while
keeping why-comments. No behavior changes — tests and `~shared` imports stay green throughout.

**Folder split (`web/src` only; backend `src/` untouched)**
- `web/src/components/` — the `.tsx` views (`App`, `FileCardNode`, `FilePalette`, `FileTree`,
  `GradientEdge`, `SourcePanel`, `SourceView`).
- `web/src/hooks/` — `useGraphView`, `useCanvasLayout`.
- `web/src/lib/` — pure logic (`graphView`, `mergeNodes`, `treeBuilder`).
- Update relative imports; `~shared` alias is unaffected. `main.tsx`, `styles.css` stay at root.

**Object-literal grouping (no classes)**
- Where a named grouping reads better than loose exports, expose a plain object, e.g.
  `export const treeOps = { buildTree, descendantFiles, folderPaths }`. Pure functions that
  read fine standalone stay as bare exports. No classes; the server stays a factory.

**Expressive renames (delete the what-comment by naming the thing)**
- `buildGraph.ts`: extract the two `.gitignore` walks into `loadAncestorGitignores()` /
  `loadDescendantGitignores()`; rename `raw`→`modulePath`, `ig`→`ignorer`, `tc`→`tsconfigJson`,
  `out`→`acc`. Extract the reverse-edge pass into `buildReverseIndex(forward)`.
- `treeBuilder.ts`: `collapse` → `compressSingleChildChains` (collides with the UI "collapse").
- `useCanvasLayout.ts`: `anchorRef` → `expansionAnchorRef`, `laidOutSig` → `lastLayoutSig`.
- `mergeNodes.ts`: `fresh` → `newCardCount`; `mergeNodes` → `reconcileCanvasNodes`.
- `App.tsx`: extract the scope-param IIFE into `parseScopeParam()`.
- `FileTree.tsx`: replace `// 20 = icon width (14) + gap (6)` with named constants
  (`ICON_WIDTH`, `ICON_GAP`, `INDENT_STEP`).
- `mergeNodes.ts`: name the `24`px fan-out offset (`STACK_OFFSET`).

**Env-var rename (leftover from the interweave→intertangle rename)**
- `cli.ts`: `INTERWEAVE_ROOT` / `INTERWEAVE_PORT` / `INTERWEAVE_NO_OPEN` → `INTERTANGLE_*`.
  No back-compat alias needed (no released users at v0.1.1). Update README if it mentions them.

**Comments: delete what, keep why**
- Delete redundant what-comments superseded by the renames above.
- **Keep** why-comments: `canvas.ts` layout-direction / dynamic-import / 0,0-position rationale;
  `server.ts` `+ path.sep` security note; `GradientEdge` gradient-coordinate note; all
  `ponytail:` markers; the `useCanvasLayout` anchor temporal-coupling note (or remove the note
  only if the coupling itself is refactored away).

## Acceptance criteria

- [x] `web/src` is split into `components/`, `hooks/`, `lib/`; build and tests pass after import updates. (`npm test`, `npm run build`)
- [x] Renames applied; no `collapse`/`anchorRef`/`laidOutSig`/`mergeNodes`/`raw`/`ig`/`tc` identifiers remain for the listed cases. (test: grep + green tests, including renamed test imports)
- [x] `INTERWEAVE_*` env vars are gone; `INTERTANGLE_*` work end to end. (manual-verify with `INTERTANGLE_PORT`) (manual-verify)
- [x] What-comments removed; the listed why-comments and `ponytail:` markers remain. (manual-verify)
- [x] `npx biome check .` is clean. (test)
- [x] App behavior unchanged. (manual-verify)

## Blocked by

- 09 — Remove avoidable useEffect
