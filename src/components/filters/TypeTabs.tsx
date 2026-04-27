const TYPES: { key: 'all'|'music'|'food'|'arts'|'outdoors'|'civic'|'community'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'music',     label: 'Music' },
  { key: 'food',      label: 'Food' },
  { key: 'arts',      label: 'Arts' },
  { key: 'outdoors',  label: 'Outdoors' },
  { key: 'civic',     label: 'Civic' },
  { key: 'community', label: 'Community' },
]

export function TypeTabs({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {TYPES.map((t, i) => {
        const active = value === t.key
        const rot = i % 2 === 0 ? '-rotate-1' : 'rotate-1'
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`font-mono uppercase text-xs tracking-wider border-2 px-2 py-1 transform ${rot} ${
              active ? 'border-stamp text-stamp' : 'border-muted text-muted'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
