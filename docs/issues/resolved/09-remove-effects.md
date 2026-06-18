# 09 — Remove avoidable useEffect

**Type:** Refactor (readability initiative)
**Stories:** — (code-quality pass, beyond PRD stories)

## What to build

Cut the four `useEffect`s that exist only to bridge async data and persistence, using React 19's
`use()` + Suspense. Keep the effects that are genuinely effectful. Behavior is unchanged; the
data-flow just stops routing through effects.

**Fetch via `use()` + Suspense (removes 2 effects)**
- Cache the fetch promises at module scope so `use()` doesn't refetch each render:
  `const graphPromise = fetch('/graph').then(r => r.json())` and a small per-path cache for
  `/file` (`Map<string, Promise<string>>`).
- `App` reads the graph with `use(graphPromise)` instead of the mount `useEffect` + `setGraph`.
- `SourceView` reads with `use(filePromise(path))` instead of its fetch `useEffect`; the manual
  `cancelled` race-guard goes away (Suspense + the cache handle ordering).
- Wrap the canvas/source subtree in a `<Suspense fallback={…}>` and an error boundary
  (one small `ErrorBoundary` class component — the one place React still requires a class).

**localStorage without effects (removes 2 effects)**
- Because the graph now resolves before render, `graph.root` is known synchronously: hydrate
  exclusions in the `useReducer` **initializer** (`localStorage.getItem(excludedKey(root))`),
  dropping the hydrate effect and its `hydrated` ref guard.
- Persist in a thin dispatch wrapper (write `localStorage.setItem` after dispatching a
  mutation that changes `excluded`) — an event-path write, not an effect. The `graphView`
  reducer stays pure.

**Keep (genuinely effectful — do not touch)**
- `App` keyboard listener (`window.addEventListener('keydown', …)`).
- `useCanvasLayout` measure → layout → focus (3 effects) — intrinsic to React Flow's
  measure-then-position lifecycle.
- `FileTree` "reveal active file" effect.

**Fix the buggy one**
- `FileTree` hydration-reseed currently re-fires on every `excluded` change, clobbering folders
  the user manually toggled. Gate it to run once (ref flag, like the old `useGraphView` guard)
  or derive initial collapsed state in the reducer/initializer instead.

## Acceptance criteria

- [x] `/graph` and `/file` load via `use()` + Suspense; no fetch `useEffect` remains. (test: grep `web/src` for `fetch(` inside `useEffect` is empty)
- [x] localStorage hydrate + persist no longer use `useEffect`; `graphView` reducer remains pure. (test: existing `graphView.test.ts` passes; grep shows no `localStorage` in a `useEffect`)
- [x] A Suspense fallback shows while the graph loads, and an error boundary renders a message on fetch failure. (manual-verify)
- [x] Exclusions still survive reload, per-project, and don't leak across projects. (manual-verify)
- [x] Manually toggling a folder is no longer reset when an unrelated exclusion changes. (manual-verify)
- [x] Keyboard shortcuts, canvas layout/focus, and reveal-active still work. (manual-verify)
- [x] All existing tests pass. (`npm test`)

## Blocked by

- 08 — React 19 + React Compiler
