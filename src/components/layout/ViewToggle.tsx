interface ViewToggleProps {
  view: 'week' | 'day'
  onChange: (v: 'week' | 'day') => void
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1">
      {(['week', 'day'] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`font-mono uppercase text-xs tracking-wider border-2 px-2 py-1 ${
            view === v ? 'border-stamp text-stamp' : 'border-muted text-muted'
          }`}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
