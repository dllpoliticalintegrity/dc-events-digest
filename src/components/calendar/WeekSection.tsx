import { useMemo } from 'react'
import type { EventRow } from '@/hooks/useEventsForWeek'
import { useEventsForWeek } from '@/hooks/useEventsForWeek'
import {
  sevenDays, formatWeekRange, formatDayHeading, isoDateString, localDateKey, todayStamp,
} from '@/lib/dates'
import { EventLine } from './EventLine'

export interface WeekSectionProps {
  weekStart: Date
  type: string
  tags: string[]
  hasFilters: boolean
  onClearFilters: () => void
  onSelectEvent: (e: EventRow) => void
}

/**
 * One "page" of the vertical calendar: a sticky week header followed by the
 * seven days of that week, each with its events as compact rows. Each section
 * fetches its own week so the feed can append weeks independently.
 */
export function WeekSection({ weekStart, type, tags, hasFilters, onClearFilters, onSelectEvent }: WeekSectionProps) {
  const { events, loading, error } = useEventsForWeek(weekStart, type, tags)
  const days = useMemo(() => sevenDays(weekStart), [weekStart])
  const today = isoDateString(todayStamp())
  const isCurrentWeek = days.some(d => isoDateString(d) === today)

  const byDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {}
    for (const e of events) {
      const k = localDateKey(e.start_at)
      ;(map[k] ??= []).push(e)
    }
    for (const k in map) map[k].sort((a, b) => a.start_at.localeCompare(b.start_at))
    return map
  }, [events])

  const count = events.length
  const countLabel = loading ? '…' : `${count} EVENT${count === 1 ? '' : 'S'}`

  return (
    <section
      data-testid={`week-${isoDateString(weekStart)}`}
      data-week={isoDateString(weekStart)}
      aria-label={`Week of ${formatWeekRange(weekStart)}`}
      className="scroll-mt-4"
    >
      <header className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b-2 border-ink py-2 flex items-baseline gap-3">
        <h2 className="font-serif text-lg font-bold text-ink">{formatWeekRange(weekStart)}</h2>
        {isCurrentWeek && (
          <span className="font-mono text-[10px] tracking-widest border border-stamp text-stamp px-1.5 py-0.5 -rotate-2">
            THIS WEEK
          </span>
        )}
        <span className="ml-auto font-mono text-xs text-muted tracking-widest">{countLabel}</span>
      </header>

      {error && (
        <div className="font-mono text-xs text-stamp py-4">Could not load this week: {error}</div>
      )}

      {!error && (
        <ol className="divide-y divide-dashed divide-gray-300">
          {days.map(day => {
            const key = isoDateString(day)
            const dayEvents = byDay[key] ?? []
            const isToday = key === today
            return (
              <li key={key} data-testid={`day-${key}`} className={`py-3 ${isToday ? 'bg-white/60 -mx-2 px-2' : ''}`}>
                <h3 className="font-mono text-xs tracking-widest mb-2 flex items-center gap-2">
                  <span className={isToday ? 'text-stamp font-semibold' : 'text-muted'}>— {formatDayHeading(day)}</span>
                  {isToday && <span className="text-stamp font-semibold">· TODAY</span>}
                  {!loading && dayEvents.length > 0 && (
                    <span className="text-muted">· {dayEvents.length}</span>
                  )}
                </h3>
                {loading ? (
                  <div className="font-mono text-xs text-muted">Loading…<span className="animate-pulse">▌</span></div>
                ) : dayEvents.length === 0 ? (
                  <div className="font-mono text-xs text-muted/70 pl-1">— nothing listed</div>
                ) : (
                  <ul className="space-y-1">
                    {dayEvents.map(e => (
                      <EventLine key={e.id} event={e} onClick={() => onSelectEvent(e)} />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {!error && !loading && count === 0 && hasFilters && (
        <div className="font-mono text-xs text-muted py-3">
          No events match your filters this week.{' '}
          <button onClick={onClearFilters} className="underline hover:text-ink">Clear filters</button>
        </div>
      )}
    </section>
  )
}
