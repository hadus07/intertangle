import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { Component, type ReactNode, Suspense, useState } from 'react'
import SourceView from './SourceView'

class SourceErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() {
    return { err: true }
  }
  render() {
    if (this.state.err)
      return (
        <div className="font-mono text-[11px] text-danger-text py-1">failed to load source</div>
      )
    return this.props.children
  }
}

const actionBase =
  'bg-transparent border-0 p-0 appearance-none outline-none flex items-center justify-center w-4.5 h-4.5 rounded text-[12px] leading-none text-muted cursor-pointer transition-[color,background] duration-120 hover:text-accent-hover hover:bg-accent-wash-soft'
const actionRemove = `${actionBase} hover:text-danger hover:bg-danger-wash`

export default function SourcePanel({ path, onClose }: { path: string; onClose(): void }) {
  const [copied, setCopied] = useState(false)

  const copyPath = () => {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  // ponytail: server opens the file in the OS default app for its type; swap for
  // an explicit editor command / $EDITOR if "default app" isn't the editor.
  const openInEditor = () => {
    fetch(`/open?path=${encodeURIComponent(path)}`).catch((err) =>
      console.error('failed to open in editor', err),
    )
  }

  return (
    <div className="flex flex-col h-full bg-source border-l border-border">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border shrink-0">
        <div
          className="flex-1 min-w-0 font-mono text-[11px] text-muted whitespace-nowrap overflow-hidden text-ellipsis [direction:rtl] text-left"
          title={path}
        >
          {path}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            className={actionBase}
            title="Copy relative path"
            onClick={copyPath}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className={actionBase}
            title="Open in code editor"
            onClick={openInEditor}
          >
            <ExternalLink size={14} />
          </button>
          <button type="button" className={actionRemove} title="Close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>
      <SourceErrorBoundary>
        <Suspense fallback={<div className="font-mono text-[11px] text-faint py-1">loading…</div>}>
          <SourceView path={path} className="flex-1 min-h-0" />
        </Suspense>
      </SourceErrorBoundary>
    </div>
  )
}
