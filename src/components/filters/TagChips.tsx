const TAGS = ['free','ticketed','outdoor','21+','family','accessible','weekend','happy-hour'] as const

export function TagChips({ selected, onToggle }: { selected: string[]; onToggle: (t: string) => void }) {
  const sel = new Set(selected)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TAGS.map((t, i) => {
        const active = sel.has(t)
        const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            className={`font-mono text-[10px] uppercase border px-2 py-0.5 whitespace-nowrap transform ${rot} ${
              active ? 'border-stamp text-stamp' : 'border-muted text-muted'
            }`}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}
