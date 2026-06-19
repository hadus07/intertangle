import { use } from 'react'
import { cn } from '../lib/cn'

const fileCache = new Map<string, Promise<string>>()

function getFile(path: string): Promise<string> {
  let p = fileCache.get(path)
  if (!p) {
    p = fetch(`/file?path=${encodeURIComponent(path)}`).then(r => {
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
    <div
      className={cn(
        'source-panel font-mono text-[12px] h-full overflow-auto p-0 bg-source text-text nowheel',
        className,
      )}
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: server returns trusted Shiki-highlighted HTML */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
