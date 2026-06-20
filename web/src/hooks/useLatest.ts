import { useRef } from 'react'

// Return a ref whose .current always holds the latest value. Useful for reading
// mutable callbacks/props inside effects without listing them in dependencies.
export function useLatest<T>(value: T) {
  const ref = useRef<T>(value)
  ref.current = value
  return ref
}
