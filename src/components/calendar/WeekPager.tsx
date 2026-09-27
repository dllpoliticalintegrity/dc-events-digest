import { useState } from 'react'
import { formatWeekRange } from '@/lib/dates'
import { MonthPicker } from './MonthPicker'

export interface WeekPagerProps {
  weekStart: Date
  isCurrentWeek: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onPickDate: (day: Date) => void
  compact?: boolean
}

/** Previous / next week controls; the week label opens a month grid for jumping to any date. */
export function WeekPager({ weekStart, isCurrentWeek, onPrev, onNext, onToday, onPickDate, compact = false }: WeekPagerProps) {
  const [open, setOpen] = useState(false)
  return (
    <nav aria-label="week navigation" className="relative flex items-center gap-3 font-mono text-xs">
      <button
        onClick={onPrev}
        aria-label="previous week"
        className="border border-gray-400 bg-white px-2 py-1 hover:border-ink hover:text-ink text-muted"
      >
        ◂ prev week
      </button>
      <div className="flex-1 flex justify-center min-w-0">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="jump to date"
          aria-expanded={open}
          className="text-muted tracking-widest truncate hover:text-ink underline decoration-dotted underline-offset-4"
        >
          {compact ? '📅 jump to date' : `📅 ${formatWeekRange(weekStart).toUpperCase()}`}
        </button>
      </div>
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
      {open && (
        <MonthPicker
          weekStart={weekStart}
          onPick={day => { setOpen(false); onPickDate(day) }}
          onClose={() => setOpen(false)}
        />
      )}
    </nav>
  )
}
