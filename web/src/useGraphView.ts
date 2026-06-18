import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ExpandDirection } from '~shared/canvas'
import type { Graph } from '~shared/graph'
import { type GraphViewState, graphView } from './graphView'

const excludedKey = (root: string) => `intertangle:excluded:${root}`

function readSeeds(): Set<string> {
  const raw = new URLSearchParams(window.location.search).get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

export function useGraphView(graph: Graph | null) {
  const [state, dispatch] = useReducer(
    (s: GraphViewState, a: Parameters<typeof graphView>[2]) => (graph ? graphView(graph, s, a) : s),
    null,
    (): GraphViewState => ({ expanded: readSeeds(), excluded: new Set(), sourcePath: null }),
  )

  // Gates the persist effect so the first post-load write can't clobber saved
  // exclusions before hydration lands.
  // ponytail: ref guard, not a debounce — hydration is a single one-shot event.
  const hydrated = useRef(false)

  useEffect(() => {
    if (!graph || hydrated.current) return
    const saved = localStorage.getItem(excludedKey(graph.root))
    if (saved) dispatch({ type: 'hydrateExclusions', excluded: JSON.parse(saved) })
    hydrated.current = true
  }, [graph])

  useEffect(() => {
    if (!graph || !hydrated.current) return
    localStorage.setItem(excludedKey(graph.root), JSON.stringify([...state.excluded]))
  }, [state.excluded, graph])

  return {
    expanded: state.expanded,
    excluded: state.excluded,
    sourcePath: state.sourcePath,
    expand: useCallback(
      (path: string, direction: ExpandDirection) => dispatch({ type: 'expand', path, direction }),
      [],
    ),
    seed: useCallback((path: string) => dispatch({ type: 'seed', path }), []),
    showSource: useCallback((path: string) => dispatch({ type: 'showSource', path }), []),
    hideSource: useCallback(() => dispatch({ type: 'showSource', path: null }), []),
    remove: useCallback((path: string) => dispatch({ type: 'remove', path }), []),
    setExclusion: useCallback(
      (files: string[], exclude: boolean) => dispatch({ type: 'setExclusion', files, exclude }),
      [],
    ),
    clear: useCallback(() => dispatch({ type: 'clear' }), []),
  }
}
