import { formatWeekRange } from '@/lib/dates'

export interface WeekPagerProps {
  weekStart: Date
  isCurrentWeek: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  compact?: boolean
}

/** Previous / next week controls with the week label; used above and below the week. */
export function WeekPager({ weekStart, isCurrentWeek, onPrev, onNext, onToday, compact = false }: WeekPagerProps) {
  return (
    <nav aria-label="week navigation" className="flex items-center gap-3 font-mono text-xs">
      <button
        onClick={onPrev}
        aria-label="previous week"
        className="border border-gray-400 bg-white px-2 py-1 hover:border-ink hover:text-ink text-muted"
      >
        ◂ prev week
      </button>
      {!compact && (
        <span className="flex-1 text-center text-muted tracking-widest truncate">
          {formatWeekRange(weekStart).toUpperCase()}
        </span>
      )}
      {compact && <span className="flex-1" />}
      {!isCurrentWeek && (
        <button onClick={onToday} className="underline text-muted hover:text-stamp">Today</button>
      )}
      <button
        onClick={onNext}
        aria-label="next week"
        className="border border-gray-400 bg-white px-2 py-1 hover:border-ink hover:text-ink text-muted"
      >
        next week ▸
      </button>
    </nav>
  )
}
