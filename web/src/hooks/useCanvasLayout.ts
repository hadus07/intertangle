import type { Edge, Node } from '@xyflow/react'
import { useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import { useEffect, useReducer, useRef } from 'react'
import type { CardHandlers, FileCardData } from '~shared/canvas'
import type { Graph } from '~shared/graph'
import type { Focus, LayoutResult, Sizes } from '../lib/canvasLayoutEngine'
import { cameraForNode, layout, measure, project } from '../lib/canvasLayoutEngine'
import { useLatest } from './useLatest'

const CENTER_DURATION_MS = 400
const FIT_VIEW_DURATION_MS = 300

type State =
  | { name: 'idle' }
  | { name: 'measure'; focus: Focus }
  | { name: 'layout'; focus: Focus; sizes: Sizes; layoutKey: string }
  | {
      name: 'apply'
      focus: Focus
      result: LayoutResult
      layoutKey: string
    }
  | { name: 'focus'; path: string }

type Action =
  | { type: 'measure'; focus: Focus }
  | { type: 'layout'; focus: Focus; sizes: Sizes; layoutKey: string }
  | { type: 'laid'; focus: Focus; result: LayoutResult; layoutKey: string }
  | { type: 'applied' }
  | { type: 'layoutFailed' }
  | { type: 'focusImmediate'; path: string }
  | { type: 'focused' }

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'measure':
      return { name: 'measure', focus: action.focus }
    case 'layout':
      return {
        name: 'layout',
        focus: action.focus,
        sizes: action.sizes,
        layoutKey: action.layoutKey,
      }
    case 'laid':
      return {
        name: 'apply',
        focus: action.focus,
        result: action.result,
        layoutKey: action.layoutKey,
      }
    case 'applied':
    case 'layoutFailed':
      return { name: 'idle' }
    case 'focusImmediate':
      return { name: 'focus', path: action.path }
    case 'focused':
      return { name: 'idle' }
  }
}

export function useCanvasLayout(
  graph: Graph | null,
  expanded: Set<string>,
  excluded: Set<string>,
  { onExpand, onShowSource, onRemove }: CardHandlers,
  seed: (path: string) => void,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView, setCenter } = useReactFlow()
  const [state, dispatch] = useReducer(reducer, { name: 'idle' })

  // Pending work for the projection -> layout -> camera pipeline. The reducer
  // owns the explicit phase; this ref only holds the cross-render intent that
  // originates from event handlers (expand anchor, focus that needs layout).
  const intentRef = useRef<{ anchor: string | null; focus: Focus }>({
    anchor: null,
    focus: null,
  })

  // Generation counter so a stale elk result from an earlier request cannot
  // overwrite positions from a newer request.
  const layoutGen = useRef(0)

  // String key of the last laid-out node sizes; only re-layout when ids/sizes change.
  const lastLayoutKey = useRef<string | null>(null)

  // User callbacks are not reactive inputs to the projection pass. Holding them
  // in a ref keeps the effect dependency array limited to the data that actually changes.
  const handlersRef = useLatest({ onExpand, onShowSource, onRemove })

  // Pass 1 — node/edge existence + data (pure, no elk). Preserves prior
  // position and measured size for surviving nodes; seeds new ones near the
  // expand anchor so they emerge from under the expanded card.
  // biome-ignore lint/correctness/useExhaustiveDependencies: handlers are read from a stable ref so Pass 1 only reruns when graph/expanded/excluded change
  useEffect(() => {
    if (!graph) return

    const { anchor, focus } = intentRef.current
    intentRef.current = { anchor: null, focus: null }

    const handlers: CardHandlers = {
      onExpand: (path, direction) => {
        intentRef.current.anchor = path
        handlersRef.current.onExpand?.(path, direction)
      },
      onShowSource: handlersRef.current.onShowSource,
      onRemove: handlersRef.current.onRemove,
    }

    const {
      nodes: nextNodes,
      edges: nextEdges,
      needsLayout,
      layoutKey,
    } = project(graph, { visible: expanded, excluded }, nodes, handlers, { anchor, focus })

    setNodes(nextNodes)
    setEdges(nextEdges)

    if (!needsLayout) {
      dispatch({ type: 'focusImmediate', path: focus?.path ?? '' })
      return
    }

    if (layoutKey !== lastLayoutKey.current) {
      dispatch({ type: 'measure', focus })
    }
  }, [graph, expanded, excluded, setNodes, setEdges])

  // Pass 2/3 — re-layout with measured sizes and move the camera. The reducer
  // makes the phase explicit: measure -> layout -> apply, plus a fast focus path
  // for cards that are already on the canvas.
  useEffect(() => {
    switch (state.name) {
      case 'idle':
        return runIdlePhase(nodes, lastLayoutKey, dispatch)
      case 'measure':
        return runMeasurePhase(nodes, state.focus, lastLayoutKey, dispatch)
      case 'layout':
        return runLayoutPhase(
          { nodes, edges, sizes: state.sizes, layoutKey: state.layoutKey, focus: state.focus },
          { layoutGen, dispatch },
        )
      case 'apply':
        return runApplyPhase(
          { result: state.result, layoutKey: state.layoutKey },
          { setNodes, setCenter, fitView, lastLayoutKey, dispatch },
        )
      case 'focus':
        return runFocusPhase({ nodes, path: state.path }, { setCenter, setNodes, dispatch })
    }
  }, [state, nodes, edges, setNodes, setCenter, fitView])

  // Arm focus, then seed. For cards already on canvas, jump straight to the
  // focus state; otherwise carry the focus through the projection/layout pipeline.
  function focusOn(path: string) {
    const alreadyOnCanvas = nodes.some(n => n.id === path)
    if (alreadyOnCanvas) {
      dispatch({ type: 'focusImmediate', path })
      return
    }
    intentRef.current.focus = { path, needsLayout: true }
    seed(path)
  }

  return { nodes, edges, onNodesChange, onEdgesChange, focusOn }
}

function runIdlePhase(
  nodes: Node<FileCardData>[],
  lastLayoutKey: { current: string | null },
  dispatch: (action: Action) => void,
) {
  if (nodes.length === 0) return
  const sizes = measure(nodes)
  if (!sizes || sizes.key === lastLayoutKey.current) return
  dispatch({ type: 'measure', focus: null })
}

function runMeasurePhase(
  nodes: Node<FileCardData>[],
  focus: Focus,
  lastLayoutKey: { current: string | null },
  dispatch: (action: Action) => void,
) {
  const sizes = measure(nodes)
  if (!sizes) return
  if (sizes.key === lastLayoutKey.current) {
    dispatch({ type: 'applied' })
    return
  }
  dispatch({ type: 'layout', focus, sizes, layoutKey: sizes.key })
}

interface LayoutInput {
  nodes: Node<FileCardData>[]
  edges: Edge[]
  sizes: Sizes
  layoutKey: string
  focus: Focus
}

interface LayoutApi {
  layoutGen: { current: number }
  dispatch: (action: Action) => void
}

function runLayoutPhase(
  { nodes, edges, sizes, layoutKey, focus }: LayoutInput,
  { layoutGen, dispatch }: LayoutApi,
) {
  const gen = ++layoutGen.current
  layout({ nodes, edges, sizes: sizes.sizes, focus }).then(result => {
    if (gen !== layoutGen.current) return
    dispatch({ type: 'laid', focus, result, layoutKey })
  })
}

interface ApplyInput {
  result: LayoutResult
  layoutKey: string
}

interface ApplyApi {
  setNodes: (updater: (prev: Node<FileCardData>[]) => Node<FileCardData>[]) => void
  setCenter: (x: number, y: number, options?: { duration?: number }) => void
  fitView: (options?: { padding?: number; duration?: number }) => void
  lastLayoutKey: { current: string | null }
  dispatch: (action: Action) => void
}

function runApplyPhase(
  { result, layoutKey }: ApplyInput,
  { setNodes, setCenter, fitView, lastLayoutKey, dispatch }: ApplyApi,
) {
  const laidById = new Map(result.nodes.map(n => [n.id, n]))
  setNodes(prev =>
    prev.map(node => {
      const laid = laidById.get(node.id)
      return laid
        ? { ...node, position: laid.position, selected: laid.selected }
        : { ...node, selected: node.id === result.selectedPath }
    }),
  )

  if (result.camera.type === 'center') {
    setCenter(result.camera.x, result.camera.y, { duration: CENTER_DURATION_MS })
  } else {
    fitView({ padding: 0.2, duration: FIT_VIEW_DURATION_MS })
  }

  lastLayoutKey.current = layoutKey
  dispatch({ type: 'applied' })
}

interface FocusApi {
  setNodes: (updater: (prev: Node<FileCardData>[]) => Node<FileCardData>[]) => void
  setCenter: (x: number, y: number, options?: { duration?: number }) => void
  dispatch: (action: Action) => void
}

interface FocusInput {
  nodes: Node<FileCardData>[]
  path: string
}

function runFocusPhase({ nodes, path }: FocusInput, { setCenter, setNodes, dispatch }: FocusApi) {
  const node = nodes.find(n => n.id === path)
  if (!node) return
  const action = cameraForNode(node, node.position)
  if (action.type === 'center') {
    setCenter(action.x, action.y, { duration: CENTER_DURATION_MS })
  }
  setNodes(prev =>
    prev.map(n => ({
      ...n,
      selected: n.id === path,
    })),
  )
  dispatch({ type: 'focused' })
}
