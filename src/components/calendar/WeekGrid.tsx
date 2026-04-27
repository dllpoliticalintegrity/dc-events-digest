import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sevenDays, formatTime } from '@/lib/dates'
import type { EventRow } from '@/hooks/useEventsForWeek'

const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const TYPE_BORDER: Record<string, string> = {
  music: 'border-l-stamp',
  food: 'border-l-yellow-600',
  arts: 'border-l-purple-600',
  outdoors: 'border-l-green-700',
  civic: 'border-l-blue-700',
  community: 'border-l-gray-500',
}

const MAX_VISIBLE = 5

interface WeekGridProps {
  weekStart: Date
  events: EventRow[]
  eventTags: Record<string, string[]>
}

function DayColumn({ day, events }: { day: Date; events: EventRow[] }) {
  const [expanded, setExpanded] = useState(false)

  const todayUtc = new Date()
  const isToday =
    todayUtc.getUTCFullYear() === day.getUTCFullYear() &&
    todayUtc.getUTCMonth() === day.getUTCMonth() &&
    todayUtc.getUTCDate() === day.getUTCDate()

  const dayEvents = events
    .filter(e => {
      const d = new Date(e.start_at)
      return (
        d.getUTCFullYear() === day.getUTCFullYear() &&
        d.getUTCMonth() === day.getUTCMonth() &&
        d.getUTCDate() === day.getUTCDate()
      )
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const overflow = dayEvents.length - MAX_VISIBLE
  const visible = expanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE)

  const dayLabel = DAYS_SHORT[day.getUTCDay()]
  const dayNum = day.getUTCDate()

  return (
    <div
      className={`flex flex-col border border-gray-200 p-1 min-w-[75%] snap-start md:min-w-0 ${
        isToday ? 'border-stamp border-2' : ''
      }`}
    >
      {/* Column header */}
      <div className="text-center mb-1">
        <div className="font-mono text-[10px] font-semibold text-muted uppercase tracking-wider">
          {dayLabel}
        </div>
        <div className={`font-mono text-sm font-bold ${isToday ? 'text-stamp' : 'text-ink'}`}>
          {dayNum}
        </div>
      </div>

      {/* Events or placeholder */}
      <div className="flex flex-col gap-1 flex-1">
        {dayEvents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center font-mono text-sm text-muted">
            —
          </div>
        ) : (
          <>
            {visible.map(e => {
              const border = TYPE_BORDER[e.type] ?? 'border-l-gray-400'
              return (
                <Link
                  key={e.id}
                  to={`/event/${e.id}`}
                  className={`block border-l-2 ${border} pl-1 bg-white hover:bg-gray-50`}
                >
                  <div className="font-mono text-[9px] text-muted leading-tight">
                    {formatTime(e.start_at)}
                  </div>
                  <div className="font-sans text-[10px] text-ink leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
                    {e.title}
                  </div>
                </Link>
              )
            })}
            {overflow > 0 && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="font-mono text-[9px] text-muted hover:text-ink underline text-left mt-auto"
              >
                +{overflow} more
              </button>
            )}
            {expanded && (
              <button
                onClick={() => setExpanded(false)}
                className="font-mono text-[9px] text-muted hover:text-ink underline text-left mt-auto"
              >
                show less
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function WeekGrid({ weekStart, events }: WeekGridProps) {
  const days = sevenDays(weekStart)

  return (
    <div className="md:grid md:grid-cols-7 md:gap-2 flex overflow-x-auto snap-x snap-mandatory gap-2">
      {days.map(day => (
        <DayColumn key={day.toISOString()} day={day} events={events} />
      ))}
    </div>
  )
}
