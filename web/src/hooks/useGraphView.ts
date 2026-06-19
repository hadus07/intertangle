import { useReducer } from 'react'
import type { ExpandDirection } from '~shared/canvas'
import type { Graph } from '~shared/graph'
import { type GraphViewState, graphView } from '../lib/graphView'

const excludedKey = (root: string) => `intertangle:excluded:${root}`

function readSeeds(): Set<string> {
  const raw = new URLSearchParams(window.location.search).get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

export function useGraphView(graph: Graph) {
  const [state, rawDispatch] = useReducer(
    (s: GraphViewState, a: Parameters<typeof graphView>[2]) => graphView(graph, s, a),
    graph,
    (g): GraphViewState => ({
      expanded: readSeeds(),
      excluded: new Set(JSON.parse(localStorage.getItem(excludedKey(g.root)) ?? '[]')),
      sourcePath: null,
    }),
  )

  function setExclusion(files: string[], exclude: boolean) {
    const next = new Set(state.excluded)
    for (const f of files) {
      if (exclude) next.add(f)
      else next.delete(f)
    }
    localStorage.setItem(excludedKey(graph.root), JSON.stringify([...next]))
    rawDispatch({ type: 'setExcluded', excluded: next })
  }

  return {
    expanded: state.expanded,
    excluded: state.excluded,
    sourcePath: state.sourcePath,
    expand: (path: string, direction: ExpandDirection) =>
      rawDispatch({ type: 'expand', path, direction }),
    seed: (path: string) => rawDispatch({ type: 'seed', path }),
    showSource: (path: string) => rawDispatch({ type: 'showSource', path }),
    hideSource: () => rawDispatch({ type: 'showSource', path: null }),
    remove: (path: string) => rawDispatch({ type: 'remove', path }),
    setExclusion,
    clear: () => rawDispatch({ type: 'clear' }),
  }
}
