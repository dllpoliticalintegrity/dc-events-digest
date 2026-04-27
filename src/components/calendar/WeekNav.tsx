import { formatWeekRange } from '@/lib/dates'

export function WeekNav({
  weekStart, onPrev, onNext, onToday,
}: {
  weekStart: Date; onPrev: () => void; onNext: () => void; onToday: () => void
}) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <button aria-label="previous week" onClick={onPrev} className="font-serif text-xl">◂</button>
      <div className="font-mono text-sm flex-1 text-center">{formatWeekRange(weekStart)}</div>
      <button aria-label="next week" onClick={onNext} className="font-serif text-xl">▸</button>
      <button onClick={onToday} className="font-mono text-xs underline">Today</button>
    </div>
  )
}
