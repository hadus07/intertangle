# 14 — Glob hide-pattern chips filter the file tree and palette

**Type:** AFK
**Stories:** 1–14, 19, 20–25
**Source:** `docs/prd/prd-hide-patterns.md`

## What to build

A single-line glob input pinned in the file-tree's existing sticky header. Typing a glob
and pressing Enter commits it as a small removable chip below the input; chips accumulate
and wrap. Any local file path matching **any** chip is hidden from the **file tree** (and
folders whose every file is hidden disappear too — fully removed, not struck-through like
checkbox-`excluded` files) and dropped from the **`Cmd-K` palette**.

This slice introduces the one piece of new logic — a pure glob matcher — and wires it
through to the two cheap sidebar surfaces. The canvas is intentionally **not** affected
yet (slice 15).

**Glob matcher (new pure module).** `globToRegExp(pattern)` + `matchAny(patterns, path)`,
gitignore-style:
- `*` matches any run of chars except `/`; `**` crosses `/`; `?` matches one non-`/` char.
- No `/` in the pattern → matches the **basename or any path segment** at any depth
  (`*.test.ts` hides `src/a.test.ts`; `fixtures` hides `test/fixtures/a.ts`).
- A `/` in the pattern → **anchored at the project root** (`src/legacy` matches
  `src/legacy/old.ts`, not `x/src/legacy/old.ts`).
- **Case-sensitive** (`*.TS` does not match `a.ts`).
- Malformed pattern (e.g. unbalanced `{`) is signalled as invalid so the caller can reject
  the chip.
- No new dependency — a handful of lines, not `micromatch`.

**Chips = separate filter layer.** Chips never write into the existing `excluded` set; the
two are orthogonal. Derive `hidden = scopedPaths.filter(p => matchAny(chips, p))`; pass
`scopedPaths.filter(p => !hidden.has(p))` into `FileTree` and `FilePalette`. The `expanded`
reducer state and `graphView` are untouched. Chip state is lifted to where `App` can read
it (a small hook mirroring the existing `excludedKey`/`localStorage` pattern is fine), so
slice 15 can reuse the same `hidden` set for the canvas.

**Input UX:** Enter commits the trimmed input as one chip (one Enter = one chip, no
comma-splitting). Empty/whitespace → no-op; duplicate → ignored; invalid glob → not added,
with a transient red border on the input. `×` on a chip removes it.

**Persistence:** chips persist to `localStorage["intertangle:hidden:" + graph.root]` as a
JSON array of strings, hydrated on load — mirroring `intertangle:excluded:<root>`. No
server changes.

## Acceptance criteria

- [x] Glob matcher seam: slash-free pattern matches basename and any folder segment at any depth; slash pattern anchored at root; `*` does not cross `/` and `**` does; matching is case-sensitive; `matchAny` ORs its patterns; invalid glob is signalled. (test)
- [x] Input + wrapping chip row are pinned in the file-tree sticky header and stay visible while the tree scrolls. (manual-verify)
- [x] Pressing Enter commits the trimmed input as one chip; `×` removes it. (manual-verify)
- [x] Empty/whitespace Enter is a no-op; a duplicate pattern is ignored; an invalid glob is rejected with a transient red border (no chip added). (manual-verify)
- [x] A file matching any chip is fully removed from the file tree (not struck-through), and a folder whose every file is hidden disappears. (manual-verify)
- [x] A hidden file does not appear in the `Cmd-K` palette. (manual-verify)
- [x] Checkbox-`excluded` files still render struck-through in the tree — chips and `excluded` do not interfere with each other. (manual-verify)
- [x] Chips survive a reload under the same project root and do not leak into a different project sharing the port. (manual-verify)

## Blocked by

- None — can start immediately (builds on resolved 01 + 07).
