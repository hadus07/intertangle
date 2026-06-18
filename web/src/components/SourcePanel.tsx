import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { Component, type ReactNode, Suspense, useState } from 'react'
import SourceView from './SourceView'

class SourceErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() {
    return { err: true }
  }
  render() {
    if (this.state.err) return <div className="iw-source-error">failed to load source</div>
    return this.props.children
  }
}

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
    <div className="iw-source-side">
      <div className="iw-source-side-header">
        <div className="iw-source-side-path" title={path}>
          {path}
        </div>
        <div className="iw-source-side-actions">
          <button
            type="button"
            className="iw-card-action"
            title="Copy relative path"
            onClick={copyPath}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="iw-card-action"
            title="Open in code editor"
            onClick={openInEditor}
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            className="iw-card-action iw-card-action--remove"
            title="Close"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <SourceErrorBoundary>
        <Suspense fallback={<div className="iw-source-loading">loading…</div>}>
          <SourceView path={path} className="iw-source-side-body" />
        </Suspense>
      </SourceErrorBoundary>
    </div>
  )
}
