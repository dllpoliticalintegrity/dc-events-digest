import { sevenDays, isoDateString } from '@/lib/dates'

const DAY_INITIALS = ['M','T','W','T','F','S','S']  // Monday-first

export function WeekStrip({
  weekStart, selected, onSelect, densities,
}: {
  weekStart: Date
  selected: Date
  onSelect: (d: Date) => void
  densities: Record<string, { type: string; count: number }[]>  // iso date → markers
}) {
  const days = sevenDays(weekStart)
  const selectedIso = isoDateString(selected)
  return (
    <div className="grid grid-cols-7 gap-1 mb-3">
      {days.map((d, i) => {
        const iso = isoDateString(d)
        const isSelected = iso === selectedIso
        const markers = densities[iso] ?? []
        return (
          <button
            key={iso}
            data-testid={`day-cell-${iso}`}
            onClick={() => onSelect(d)}
            className={`bg-white border ${isSelected ? 'border-stamp border-2' : 'border-gray-300'} p-1 text-center font-serif`}
          >
            <div className="font-mono text-[10px] text-muted">{DAY_INITIALS[i]}</div>
            <div className="text-base">{d.getUTCDate()}</div>
            <div className="flex gap-0.5 justify-center mt-0.5 h-1">
              {markers.slice(0, 3).map((m, idx) => (
                <span key={idx} className="w-1.5 h-1 bg-stamp rounded-sm" />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
