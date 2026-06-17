import type { Node } from '@xyflow/react'
import type { FileCardData } from '~shared/toReactFlow'

export type CardHandlers = Pick<FileCardData, 'onExpand' | 'onShowSource' | 'onRemove'>

// Merge freshly-built nodes over the previous render: keep prior position and
// measured size for surviving cards (so an expand doesn't reset the laid-out
// canvas) and (re)inject the card callbacks, which toReactFlow leaves undefined.
export function mergeNodes(
  prev: Node<FileCardData>[],
  next: Node<FileCardData>[],
  handlers: CardHandlers,
): Node<FileCardData>[] {
  const prevById = new Map(prev.map((n) => [n.id, n]))
  return next.map((n) => {
    const old = prevById.get(n.id)
    return {
      ...n,
      position: old?.position ?? n.position,
      measured: old?.measured ?? n.measured,
      data: { ...n.data, ...handlers },
    }
  })
}
