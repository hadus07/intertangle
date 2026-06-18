# 12 — Cognitive-complexity ratchet (strict cc ≤ 8)

**Type:** Refactor (readability initiative)
**Stories:** — (code-quality pass, beyond PRD stories)

## Problem Statement

A maintainer reading this codebase feels it is "dense" but cannot point at where —
the complexity is felt, not measured. Nothing in the toolchain reports it: Biome runs
`recommended` only, and `complexity/noExcessiveCognitiveComplexity` is off. So the densest
functions — the `http.createServer` route callback and the `buildGraph` cruise-result loop —
have accumulated deeply nested branches with no guard, and any future function can do the same
silently. Without a number, "reduce complexity" has no target and no definition of done.

## Solution

Turn the feeling into a number, fix what the number flags, then make the number permanent.
Enable `noExcessiveCognitiveComplexity` at a strict `maxAllowedComplexity: 8`, reduce every
flagged function to ≤ 8 using **behavior-preserving structural extraction only** (extract
function, early-return, invert guard — never logic rewrites), and flip the rule from `warn`
to `error` once green so complexity cannot creep back through `npm run lint` / CI.

Extracted helpers are **flat module-level functions** with descriptive names — the module is
already the namespace, so no wrapper objects (this is the one place this slice departs from
issue 10's `treeOps` object-grouping pattern; see Further Notes).

The strict threshold of 8 was chosen deliberately to *find* offenders, and the team chose to
scrub the entire flagged set (including the band that is only 1–4 points over) rather than
tolerate a 9–12 grey zone.

## User Stories

1. As a maintainer, I want a metric that reports cognitive complexity, so that "this file feels dense" becomes a ranked list of specific functions instead of an unactionable feeling.
2. As a maintainer, I want the `http.createServer` callback (cc 41) split so each route is its own named handler, so that I can read one route without holding the other three in my head.
3. As a maintainer, I want the route callback to become a thin dispatcher over named handlers, so that adding a route is a one-line addition, not a deeper nest.
4. As a maintainer, I want `buildGraph` (cc 29) decomposed so the per-module and per-dependency mapping live in named helpers, so that the snapshot-construction loop reads as a sequence of named steps.
5. As a maintainer, I want the `gitignore` walk (cc 11) and `isIgnored` (cc 9) predicates lifted out, so that the ignore logic is legible in isolation from the directory recursion.
6. As a maintainer, I want `projectGraph` (cc 18) split into node-building and edge-building helpers, so that the pure projection seam reads as two clear passes.
7. As a maintainer, I want `graphView` (cc 17) decomposed into its set-building steps, so that the visible/excluded derivation is followable.
8. As a contributor, I want the `App` keydown handler (cc 19) reduced to a single keybind helper, so that the ⌘K / ⌘B bindings are not two near-identical inline blocks.
9. As a contributor, I want the `useCanvasLayout` pass-2 measure effect (cc 12) simplified by lifting its measure logic, so that the layout-after-measure intent is visible.
10. As a contributor, I want the `grill-harness.mjs` dev script (cc 20) reduced too, so that the strict run is clean across the whole repo, not just shipped code.
11. As a maintainer, I want the rule enforced at `error` once green, so that any future function over 8 fails lint and CI rather than scrolling past as a warning.
12. As a maintainer, I want every change proven behavior-preserving by the existing seam tests, so that a readability pass never silently alters graph shape, route behavior, projection, or view derivation.
13. As a maintainer, I want no new test infrastructure introduced for this pass, so that a readability cleanup does not drag in a keydown-testing harness or DOM-effect framework.
14. As a contributor, I want extracted helpers to be flat, descriptively-named functions rather than namespace objects, so that call sites stay greppable and tree-shakeable and I do not read a namespace twice.
15. As a maintainer, I want the refactor done worst-first and test-gated per hotspot, so that any regression is localized to the step that caused it.
16. As a future contributor, I want a permanent complexity floor, so that "reduce complexity" never becomes an unbounded vibe-cleanup again.

## Implementation Decisions

**Enable and configure the metric**
- Add `complexity/noExcessiveCognitiveComplexity` to `biome.json` with `maxAllowedComplexity: 8`.
- Staged at `level: "warn"` during the work; flipped to `level: "error"` as the final step once
  all hits are resolved. `npm run lint` (`biome check .`) is the CI gate.

**Scope — the nine flagged functions (strict run, max 8):**

| Hotspot | cc | Decomposition (structural only) |
|---------|----|--------------------------------|
| `server.ts` createServer callback | 41 | each route → its own named handler fn; callback becomes a thin dispatcher |
| `buildGraph` main fn | 29 | per-module → `moduleToNode`-style helper; per-dependency classify/route → helper |
| `grill-harness.mjs` `run` | 20 | extract the sequential steps into named helpers |
| `App.tsx` `onKeyDown` | 19 | one keybind helper collapsing the two near-identical meta/ctrl blocks |
| `canvas.ts` `projectGraph` | 18 | extract node-build pass and edge-build pass |
| `graphView.ts` `graphView` | 17 | extract the set-building steps |
| `useCanvasLayout.ts` pass-2 effect | 12 | lift the measure logic into a named helper |
| `buildGraph.ts` `walk` (in `loadDescendantGitignores`) | 11 | lift inner per-entry predicate |
| `buildGraph.ts` `isIgnored` | 9 | lift the repo-relative match predicate |

**Technique constraints**
- **Behavior-preserving moves only:** extract function, early-return guard, invert condition.
  No logic rewrites, no "while I'm in here" simplifications that touch control-flow semantics.
- **Flat functions, no objects:** extracted helpers are bare module-level `function` declarations
  (per CLAUDE.md style), not grouped into namespace objects. The module is the namespace.
- **No new runtime or dev dependencies.**

**Finish**
- Flip the rule to `error` at `maxAllowedComplexity: 8`. The enforced floor is 8 (not the looser
  12 that was considered), consistent with scrubbing the whole flagged set.

## Testing Decisions

- **A good test asserts external behavior at the highest existing seam, never the shape of the
  extraction.** None of these extractions get their own test — the helper is an implementation
  detail of a seam that is already covered.
- **Use existing seams; add none.** The four high-branch hotspots are already guarded:
  - `server.ts` → `test/server.test.ts` (route behavior, `/file` + `/open` traversal `403`, Zod `400`).
  - `buildGraph.ts` → `test/buildGraph.test.ts` (graph shape against fixtures, incl. `gitignored-files`).
  - `canvas.ts` `projectGraph` → `test/canvas.test.ts` (nodes/edges, counts net of exclusion).
  - `graphView.ts` → `test/graphView.test.ts` (reducer/derivation cases).
- **The Biome rule is itself the structural assertion** for the refactor's stated goal — a green
  strict run is the proof that complexity was actually reduced.
- **Gating cadence:** run `npm test` after each covered hotspot (worst-first) so a break is
  localized. The three uncovered hotspots — `App` `onKeyDown`, `useCanvasLayout` pass-2 effect,
  and `grill-harness.mjs` — are mechanical lifts with no semantic surface; verify by one browser
  smoke check (`onKeyDown` / layout) and eyeball (script). No keydown or DOM-effect harness is added.
- **Prior art:** issues 10 and 11 are the same "readability initiative" pattern — behavior-preserving
  passes proven entirely by the existing seam suite plus `biome check .`.

## Out of Scope

- Any behavior change. Graph shape, route responses, projection output, and view derivation must be
  byte-for-byte equivalent.
- Logic rewrites or algorithmic "improvements" — even if a denser expression is tempting.
- Namespace/grouping objects (the `treeOps`-style pattern from issue 10 is not extended here).
- New abstractions, new dependencies, or new test infrastructure.
- Loosening any other Biome rule, or relaxing this rule below `error` / above `8`.
- The `fullyExcludedFolders` nested ternary in `FileTree.tsx` — it reads awkwardly but scores under
  8 and is therefore left untouched.

## Further Notes

- **Current repo state:** `biome.json` already has the rule staged at `warn`/`8` (added while
  locating the hotspots). The work resumes from there and flips it to `error` as the last step.
- **Departure from issue 10:** issue 10 introduced object-literal grouping (`treeOps`). This slice
  deliberately goes flat — in ESM the module already namespaces, so an object wrapper adds a layer
  to read through, working against the goal. Both styles now coexist in the codebase; that is an
  accepted, noted inconsistency, not an oversight.
- **Why strict 8:** chosen to surface offenders aggressively. If the enforced `error` at 8 proves
  noisy against *future* code, relaxing to 12 is a one-line change — but the decision for this slice
  is to hold the floor at 8.
- **Honest value note:** the bottom of the board (`App` `onKeyDown`, `useCanvasLayout`,
  `grill-harness.mjs`) are linter-satisfying lifts that won't materially improve readability; they
  are in scope only because the team chose a spotless strict run.

## Acceptance criteria

- [x] `biome.json` has `noExcessiveCognitiveComplexity` at `error`/`maxAllowedComplexity: 8`. (test: `npm run lint` clean)
- [x] `server.ts` createServer callback split into `handleGraph`, `handleOpen`, `handleFile`, `handleStatic`, `routeRequest`; dispatcher is a one-liner. (test: `test/server.test.ts`)
- [x] `buildGraph` main loop extracted into `addModuleToGraph` + `addDependencyToGraph`. (test: `test/buildGraph.test.ts`)
- [x] `loadDescendantGitignores` inner walk lifted to `walkDescendantGitignores`; `isIgnored` inner predicate to `matchesIgnoreEntry`. (test: `test/buildGraph.test.ts`)
- [x] `projectGraph` split into `buildNodes` + `buildEdges` (+ `addVisibleEdges`). (test: `test/canvas.test.ts`)
- [x] `graphView` expand and setExclusion cases extracted into `applyExpand` + `applySetExclusion`. (test: `test/graphView.test.ts`)
- [x] `App` `onKeyDown` moved to component scope with early-return guard collapsing duplicate meta/ctrl check. (manual-verify)
- [x] `useCanvasLayout` pass-2 measure loop extracted into `collectMeasuredSizes`. (manual-verify)
- [x] `grill-harness.mjs` `run` decomposed into `pickSeedPath`, `flowPalette`, `flowChip`, `flowSourceView`, `flowExternalInert`. (manual-verify)
- [x] `npx biome check .` reports zero cc violations. (test)
- [x] All 43 seam tests pass. (test: `npm test`)
- [x] No new test infrastructure, no new runtime/dev dependencies, no logic rewrites.
- [x] All extracted helpers are flat module-level `function` declarations.

## Blocked by

- — (issues 10 and 11 of the readability initiative are resolved; nothing open blocks this)
