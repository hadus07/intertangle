# PRD: Pattern-based hide chips in the file explorer

Add a glob-pattern input to the top of the file-explorer sidebar. Committed patterns
become removable chips; any file or folder matching a chip is hidden from the file tree,
the `Cmd-K` palette, and the canvas. A separate, reversible filter layer that sits
alongside the existing per-file `excluded` checkbox mechanism without touching it.

## Problem Statement

As the maintainer exploring a real project's import graph, I constantly want to push
whole categories of files out of view — every `*.test.ts`, the `fixtures` folders, a
`src/legacy` tree — so the sidebar and canvas show only the code I care about. Today the
only way to hide files is the per-row checkbox in the file tree: I'd have to hunt down and
uncheck dozens of scattered files one at a time, and they stay visible in the tree
(struck-through) cluttering it anyway. There's no way to say "hide everything matching this
pattern" in one gesture, and no way to undo such a bulk hide cleanly.

## Solution

A single-line glob input pinned in the file-tree's existing sticky header. I type a glob
(e.g. `*.test.ts`, `fixtures`, `src/legacy`) and press Enter; it becomes a small removable
chip below the input. Chips accumulate and wrap. Any path matching **any** chip is:

- **fully removed** from the file tree (folders whose every file is hidden disappear too —
  not struck-through like checkbox-excluded files),
- **dropped** from the `Cmd-K` palette,
- and its **card/edges vanish from the canvas**, with chip counts dropping net of it.

Removing a chip (its ×) restores everything instantly, because hiding never mutates the
`expanded` set — it's a pure render-time filter. Patterns are matched gitignore-style and
persist per project root across reloads.

This is a **separate filter layer** from the existing `excluded` checkbox set. Chips never
write into `excluded`; the two combine only at the render boundaries. So "clear a chip" can
never disturb a hand-picked checkbox exclusion, and vice versa.

## User Stories

1. As the maintainer, I want a text input at the top of the file explorer, so that I can type a pattern to hide files without hunting for them individually.
2. As the maintainer, I want to press Enter to commit a pattern, so that intermediate keystrokes don't churn the canvas layout while I'm still typing.
3. As the maintainer, I want each committed pattern shown as a small chip, so that I can see at a glance which hide rules are active.
4. As the maintainer, I want a × on each chip, so that I can remove a single hide rule and restore exactly the files it was hiding.
5. As the maintainer, I want to add multiple chips, so that I can hide several unrelated categories at once (tests, fixtures, a legacy folder).
6. As the maintainer, I want a file hidden if it matches *any* chip, so that multiple rules compose the way an ignore list does.
7. As the maintainer, I want patterns to be globs, so that I use the familiar file-matching idiom rather than escaping path separators in a regex.
8. As the maintainer, I want a slash-free pattern (e.g. `*.test.ts`) to match a file's basename — or any folder segment — at any depth, so that `*.test.ts` hides every test file anywhere and `fixtures` hides every fixtures folder.
9. As the maintainer, I want a pattern containing a slash (e.g. `src/legacy`) to be anchored at the project root, so that I can target one specific subtree.
10. As the maintainer, I want `**` to cross directory boundaries and `*` to stop at one, so that glob behaves the way I expect from `.gitignore`.
11. As the maintainer, I want matching to be case-sensitive, so that `*.TS` does not hide `*.ts` — mirroring how imports actually resolve.
12. As the maintainer, I want a matched file removed entirely from the file tree, so that the tree shows only what's relevant (not a struck-through clutter line).
13. As the maintainer, I want a folder whose every file is hidden to disappear from the tree, so that empty scaffolding doesn't linger.
14. As the maintainer, I want hidden files dropped from the `Cmd-K` palette, so that I can't accidentally seed a file I've chosen to hide.
15. As the maintainer, I want a hidden file's card and its edges removed from the canvas, so that the graph reflects only visible files.
16. As the maintainer, I want chip counts on cards to drop net of hidden files, so that `imports (n)` reflects only what's actually on the canvas.
17. As the maintainer, I want a card that's already on the canvas to vanish when it starts matching a new chip, so that hiding works retroactively, not just for future expansions.
18. As the maintainer, I want removing a chip to bring back any cards it was hiding, unchanged and in place, so that hiding is fully reversible.
19. As the maintainer, I want hiding to be independent of the checkbox-`excluded` mechanism, so that clearing a pattern never disturbs files I un-checked by hand, and vice versa.
20. As the maintainer, I want my chips to survive a page reload, so that I don't retype my hide list every session.
21. As the maintainer, I want chips scoped per project root, so that one project's hide list doesn't leak into another sharing the same port.
22. As the maintainer, I want pressing Enter on an empty or whitespace-only input to do nothing, so that I don't create empty chips.
23. As the maintainer, I want a duplicate pattern ignored, so that I don't accumulate redundant chips.
24. As the maintainer, I want an invalid glob rejected with a brief visual cue on the input, so that I know it wasn't accepted rather than silently matching nothing.
25. As the maintainer, I want the input and chips pinned in the sticky header, so that they stay reachable while I scroll a long tree.

## Implementation Decisions

- **New pure module — glob matcher.** A small frontend lib exposing `globToRegExp(pattern)` and `matchAny(patterns, path)`. Gitignore-style semantics:
  - `*` matches any run of characters except `/`; `**` crosses `/`; `?` matches one non-`/` char.
  - A pattern containing **no `/`** matches if it matches the **basename or any single path segment** (so `fixtures` hides `test/fixtures/a.ts`); implemented by anchoring the converted regex to segment boundaries / prepending `**/`.
  - A pattern containing a `/` is **anchored at the project root**.
  - Matching is **case-sensitive**.
  - `globToRegExp` throws (or signals invalid) on a malformed pattern (e.g. unbalanced `{`); callers treat that as "reject the chip."
  - No new dependency — the converter is a handful of lines, not `micromatch`.

- **Chip state lifted to `App`.** Chips are an array of pattern strings owned at the `App` level (or a tiny `useHidden` hook mirroring the `excludedKey`/`localStorage` pattern already in `useGraphView`), because `App` needs the chips to derive the `hidden` set for the canvas while `FileTree` owns the input/chip UI. `FileTree` receives `chips`, `onAddChip`, `onRemoveChip` as props.

- **Derived `hidden` set, combined only at render boundaries.** `App` computes `hidden = scopedPaths.filter(p => matchAny(chips, p))`. Then:
  - **Canvas:** the union `new Set([...excluded, ...hidden])` is passed into the existing canvas-layout path (`projectGraph`'s `excluded` parameter). No `canvas.ts` change — it already accepts an `excluded` set and drops those nodes/edges and nets their counts.
  - **File tree:** `FileTree` receives `scopedPaths.filter(p => !hidden.has(p))`, so hidden files (and now-empty folders) are absent — distinct from `excluded` files, which `FileTree` still renders struck-through.
  - **Palette:** `FilePalette` receives the same `hidden`-filtered paths (in addition to its existing `excluded` drop).

- **No reducer changes.** `graphView`/`GraphViewState` and the `expanded` set are untouched. Hiding is a pure render-time view transform — exactly the stance issue 07 took for `excluded`. This is what makes hides fully reversible.

- **Commit on Enter; chips render below the input.** Enter commits the trimmed input as one chip. One Enter = one chip (no comma-splitting). Empty/whitespace → no-op; duplicate → ignored; invalid glob → not added, with a transient red border on the input.

- **Persistence.** Chips persist to `localStorage["intertangle:hidden:" + graph.root]` as a JSON array of strings, hydrated on load — mirroring `intertangle:excluded:<root>`. No server changes.

- **Placement.** Input + a wrapping chip row live inside `FileTree`'s existing `sticky top-0` header (alongside the expand-all/collapse-all buttons), so they stay pinned while the tree scrolls.

## Testing Decisions

A good test here asserts **external behavior at the highest seam** and never reaches into
implementation details — consistent with the project's testing approach (assert graph
shape / projection output / pure-function results, never dependency-cruiser / React Flow /
elk internals).

- **Glob matcher (new seam, unit test — Vitest).** This is the only genuinely new logic, so it gets the only new test. Cover the semantics decisions directly as input→output cases:
  - slash-free pattern matches basename and any folder segment at any depth (`*.test.ts` → matches `src/a.test.ts`; `fixtures` → matches `test/fixtures/a.ts`);
  - slash pattern anchored at root (`src/legacy` matches `src/legacy/old.ts`, not `x/src/legacy/old.ts`);
  - `*` does not cross `/`, `**` does;
  - case sensitivity (`*.TS` does not match `a.ts`);
  - `matchAny` is the OR of its patterns;
  - invalid glob is signalled (not silently matching everything/nothing in a surprising way).
  Prior art: the existing pure-function tests (e.g. the `treeBuilder` unit tests, and the `projectGraph` projection tests).

- **`projectGraph` (existing seam — no new test).** The existing test that asserts "given an `excluded` set, excluded nodes and the edges touching them are absent and the output stays deterministic" already covers canvas hiding, because `hidden` is folded into the same `excluded` argument. Explicitly **not** duplicating that seam for `hidden`.

- **Manual-verify (consistent with issue 07's sidebar work):** chip add/remove UX, the red-border invalid cue, tree/folder disappearance, palette omission, retroactive hiding of an on-canvas card, reversibility on chip removal, and per-root persistence across reload.

## Out of Scope

- **Regex patterns.** Glob only. Regex was explicitly rejected during design (escaping friction, invalid-mid-type).
- **Negation / un-hide patterns** (e.g. `!src/keep.ts`). Not in v1.
- **Folding chips into `excluded`** or otherwise unifying the two hide mechanisms. They stay orthogonal by decision.
- **Multi-line / textarea input**, brace-expansion mega-globs as the primary path, or live-as-you-type filtering. Commit-on-Enter, one chip per pattern.
- **Server-side filtering.** The scan, `/graph`, and `/file` are unchanged; this is purely a frontend view transform.
- **Hiding external (npm/core/unresolved) labels.** Patterns match local file paths only, as those are what the tree/palette/canvas-cards represent.

## Further Notes

- The `hidden` filter deliberately differs from `excluded` in the tree: hidden files are
  **gone**, excluded files remain **struck-through**. This is intentional — a pattern hide
  is a "I don't want to see this category" gesture, whereas a checkbox exclusion is a
  per-file scoping toggle the user may want to keep visible to flip back.
- Because matching runs over `scopedPaths` (already narrowed by the `?scope=` URL param),
  chips compose with scoping for free.
- Edges only stale on restart (the snapshot stance); hiding is a live view transform, so
  no restart is ever needed to change what's hidden.
