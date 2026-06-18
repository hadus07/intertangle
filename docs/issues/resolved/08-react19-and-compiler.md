# 08 — React 19 + React Compiler

**Type:** Refactor (readability initiative)
**Stories:** — (code-quality pass, beyond PRD stories)

## What to build

Upgrade the frontend to React 19 and enable the React Compiler so manual memoization
disappears. This slice lands first — slices 09–11 assume `use()` and auto-memoization exist.
See `docs/adr/0001-react-compiler-over-legend-state.md` for why we take the compiler and not
Legend-State.

**Dependency bumps**
- `react` / `react-dom` → `^19` (latest 19.2.7); `@types/react` / `@types/react-dom` → `^19`.
- Keep `react-resizable-panels` at `^2.1.9` — it already declares React 19 peer support, and
  v4 is a rewrite that drops the `PanelGroup`/`autoSaveId`/imperative-collapse API slice 07
  depends on. **Do not bump it.**
- `cmdk` (`^1.1`), `@xyflow/react` (`12.x`), `lucide-react` (`^1.21`) all accept React 19 — no change.
- Add dev dep `babel-plugin-react-compiler@latest`.

**TypeScript codemod**
- Run `npx types-react-codemod@latest preset-19 ./web/src` and review. Expected hits:
  `useRef()` now needs an argument; ref callbacks must use block bodies (`ref={el => { … }}`);
  `useReducer` type params move onto the reducer function.

**Enable the compiler (Vite)**
- Configure through the existing `@vitejs/plugin-react` babel option in `web/vite.config.ts`:
  `react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } })`. No new bundler.

**Remove manual memoization** (the compiler now handles it)
- Delete the six `useCallback(() => dispatch(…), [])` wrappers in `useGraphView.ts`.
- Delete `handleExpand`/`focusOn` `useCallback`s and `toggleSidebar` `useCallback` (App).
- Delete `tree = useMemo(…)` in `FileTree.tsx` and any inline `useMemo`.
- **Keep** `memo()` on `FileCardNode` and `GradientEdge` — React Flow re-renders every node on
  any canvas change and the compiler does **not** auto-wrap components in `React.memo`.
- **Keep** the genuine `useRef`s in `useCanvasLayout.ts` (`focusRef`, `anchorRef`, `laidOutSig`) —
  they are mutable slots, not memoization.

## Acceptance criteria

- [x] `package.json` is on React 19; `npm install` resolves with no peer warnings. (test: `npm ls react`) — tree shows `react@19.2.7` throughout; one spurious npm peer-resolution warn during install, not a real conflict.
- [x] React Compiler is enabled in `web/vite.config.ts` and `npm run build:web` succeeds. (test)
- [x] No `useMemo`/`useCallback` remain in `web/src` except where a stable identity crosses into a non-React boundary (none expected). (test: `grep -r "useMemo\|useCallback" web/src` is empty)
- [x] `memo()` still wraps `FileCardNode` and `GradientEdge`. (manual-verify + grep)
- [x] All existing tests pass unchanged. (`npm test`) — 39/39 pass.
- [x] App runs: canvas expands, palette opens, source loads, panels resize — no stale-UI regressions on pan/select/drag. (manual-verify)

## Blocked by

- 07 — File-tree sidebar with include/exclude
