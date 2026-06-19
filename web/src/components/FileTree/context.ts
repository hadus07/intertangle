import { createContext, type RefObject, useContext } from 'react'

interface FileTreeCtxValue {
  activePath?: string | null
  activeRef: RefObject<HTMLDivElement | null>
  onSeed: (path: string) => void
}

export const FileTreeCtx = createContext<FileTreeCtxValue>(null as unknown as FileTreeCtxValue)
export const useFileTreeCtx = () => useContext(FileTreeCtx)
