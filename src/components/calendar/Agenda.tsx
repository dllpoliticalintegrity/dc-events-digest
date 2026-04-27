import { EventCard } from './EventCard'
import { formatDayHeading } from '@/lib/dates'
import type { EventRow } from '@/hooks/useEventsForWeek'

export function Agenda({
  day, events, eventTags, onSelectEvent,
}: {
  day: Date
  events: EventRow[]
  eventTags: Record<string, string[]>
  onSelectEvent: (e: EventRow) => void
}) {
  const sameDay = events.filter(e => {
    const d = new Date(e.start_at)
    return d.getUTCFullYear() === day.getUTCFullYear()
        && d.getUTCMonth() === day.getUTCMonth()
        && d.getUTCDate() === day.getUTCDate()
  })

  const heading = formatDayHeading(day)
  const countLabel = sameDay.length === 1 ? '1 EVENT' : `${sameDay.length} EVENTS`

  return (
    <section>
      <div className="font-mono text-xs text-muted my-3 tracking-widest">
        — {heading} · {countLabel} —
      </div>
      {sameDay.length === 0 ? (
        <div className="font-mono text-sm text-muted py-6 text-center">
          No events match your filters this day.
        </div>
      ) : (
        sameDay.map(e => (
          <EventCard key={e.id} event={e} tags={eventTags[e.id] ?? []} onClick={() => onSelectEvent(e)} />
        ))
      )}
    </section>
  )
}
