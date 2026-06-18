import { use } from 'react'

const fileCache = new Map<string, Promise<string>>()

function getFile(path: string): Promise<string> {
  let p = fileCache.get(path)
  if (!p) {
    p = fetch(`/file?path=${encodeURIComponent(path)}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.text()
    })
    fileCache.set(path, p)
  }
  return p
}

export default function SourceView({ path, className = '' }: { path: string; className?: string }) {
  const html = use(getFile(path))
  return (
    // nowheel: lets trackpad scroll the code instead of panning the canvas
    <div className={`iw-source-panel nowheel ${className}`}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: server returns trusted Shiki-highlighted HTML */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
