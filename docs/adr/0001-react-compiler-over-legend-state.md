# React Compiler instead of Legend-State for state management

Frontend state stays plain React (`useReducer` + `useState`) with the **React Compiler**
enabled to remove manual `useMemo`/`useCallback`. We are **not** adopting `@legendapp/state`,
despite an earlier note claiming a migration had happened — Legend-State was never in the
codebase. The two are mutually exclusive today: Legend-State v3 mutates objects in place,
the React Compiler memoizes by reference identity, and the collision produces stale UI that
won't update until remount ([legend-state#653](https://github.com/LegendApp/legend-state/issues/653),
open as of 2026-06). We chose the compiler because it was an explicit goal and the current
state code is already small and tidy. Revisit Legend-State only if #653 is fixed upstream —
and if so, the compiler must come back out at the same time.
