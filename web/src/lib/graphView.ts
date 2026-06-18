import type { ExpandDirection } from '~shared/canvas'
import type { Graph } from '~shared/graph'

export interface GraphViewState {
  expanded: Set<string>
  excluded: Set<string>
  sourcePath: string | null
}

export type GraphViewAction =
  | { type: 'expand'; path: string; direction: ExpandDirection }
  | { type: 'seed'; path: string }
  | { type: 'showSource'; path: string | null }
  | { type: 'remove'; path: string }
  | { type: 'setExclusion'; files: string[]; exclude: boolean }
  | { type: 'clear' }

function applyExpand(
  graph: Graph,
  state: GraphViewState,
  action: Extract<GraphViewAction, { type: 'expand' }>,
): GraphViewState {
  const related =
    action.direction === 'imports' ? graph.forward[action.path] : graph.reverse[action.path]
  const expanded = new Set(state.expanded)
  for (const target of related ?? []) if (!state.excluded.has(target)) expanded.add(target)
  return { ...state, expanded }
}

function applySetExclusion(
  state: GraphViewState,
  action: Extract<GraphViewAction, { type: 'setExclusion' }>,
): GraphViewState {
  const excluded = new Set(state.excluded)
  for (const f of action.files) {
    if (action.exclude) excluded.add(f)
    else excluded.delete(f)
  }
  return { ...state, excluded }
}

// Pure: excluded is a render-time filter only — it never mutates expanded.
export function graphView(
  graph: Graph,
  state: GraphViewState,
  action: GraphViewAction,
): GraphViewState {
  switch (action.type) {
    case 'expand':
      return applyExpand(graph, state, action)
    case 'seed':
      return { ...state, expanded: new Set(state.expanded).add(action.path) }
    case 'showSource':
      return { ...state, sourcePath: action.path }
    case 'remove': {
      const expanded = new Set(state.expanded)
      expanded.delete(action.path)
      return {
        ...state,
        expanded,
        sourcePath: state.sourcePath === action.path ? null : state.sourcePath,
      }
    }
    case 'setExclusion':
      return applySetExclusion(state, action)
    case 'clear':
      return { ...state, expanded: new Set(), sourcePath: null }
  }
}
