import { useParams, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { TypeTabs } from '@/components/filters/TypeTabs'
import { TagChips } from '@/components/filters/TagChips'
import { WeekFeed } from '@/components/calendar/WeekFeed'
import { EventDetailModal } from '@/components/calendar/EventDetailModal'
import { useFilterState } from '@/hooks/useFilterState'
import type { EventRow } from '@/hooks/useEventsForWeek'
import { startOfIsoWeek, isoDateString, todayStamp } from '@/lib/dates'

function parseWeek(s?: string): Date {
  const thisWeek = startOfIsoWeek(todayStamp())
  if (!s) return thisWeek
  const d = new Date(s + 'T00:00:00Z')
  return isNaN(d.getTime()) ? thisWeek : startOfIsoWeek(d)
}

export function CalendarPage() {
  const { isoDate } = useParams()
  const nav = useNavigate()
  const anchorWeek = useMemo(() => parseWeek(isoDate), [isoDate])
  const isAnchoredOnToday = isoDateString(anchorWeek) === isoDateString(startOfIsoWeek(todayStamp()))

  const { type, tags, setType, toggleTag, clear } = useFilterState()
  const hasFilters = type !== 'all' || tags.length > 0
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null)

  const goToday = () => {
    if (!isAnchoredOnToday) nav('/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <div className="flex items-center gap-4 flex-wrap">
        <TypeTabs value={type} onChange={setType} />
        <button onClick={goToday} className="ml-auto font-mono text-xs underline hover:text-stamp">Today</button>
      </div>
      <div className="mt-2">
        <TagChips selected={tags} onToggle={toggleTag} />
      </div>
      {hasFilters && (
        <button onClick={clear} className="font-mono text-xs underline mt-2 text-muted hover:text-ink">Clear all filters</button>
      )}

      <WeekFeed
        key={isoDateString(anchorWeek)}
        anchorWeek={anchorWeek}
        type={type}
        tags={tags}
        hasFilters={hasFilters}
        onClearFilters={clear}
        onSelectEvent={setOpenEvent}
      />

      <EventDetailModal event={openEvent} onClose={() => setOpenEvent(null)} />
    </div>
  )
}
