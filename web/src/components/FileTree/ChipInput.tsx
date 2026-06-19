import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { globToRegExp } from '../../lib/glob'
import { useAppStore, useAppStoreSnapshot } from '../../store'

export function ChipInput() {
  const [value, setValue] = useState('')
  const chips = useAppStore(s => s.chips)
  const [invalid, setInvalid] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const { addChip, removeChip } = useAppStoreSnapshot()

  function flashInvalid() {
    setInvalid(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setInvalid(false), 600)
  }

  function commit() {
    const val = value.trim()
    if (!val) return
    if (chips.includes(val)) {
      setValue('')
      return
    }
    try {
      globToRegExp(val)
    } catch {
      flashInvalid()
      return
    }
    addChip(val)
    setValue('')
  }

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        placeholder="hide glob… (Enter)"
        className={cn(
          'w-full px-2 py-1 text-[11px] font-mono rounded border bg-transparent text-secondary outline-none caret-accent placeholder:text-faint transition-colors duration-120 focus:border-accent',
          invalid ? 'border-danger' : 'border-strong',
        )}
      />
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {chips.map(chip => (
            <span
              key={chip}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-elevated border border-strong text-secondary"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="inline-flex items-center justify-center w-3 h-3 text-muted hover:text-danger cursor-pointer"
                aria-label={`Remove ${chip}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  )
}
