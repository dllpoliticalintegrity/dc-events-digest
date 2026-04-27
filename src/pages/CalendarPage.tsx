import { useParams, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { TypeTabs } from '@/components/filters/TypeTabs'
import { TagChips } from '@/components/filters/TagChips'
import { WeekNav } from '@/components/calendar/WeekNav'
import { WeekStrip } from '@/components/calendar/WeekStrip'
import { DayHero } from '@/components/calendar/DayHero'
import { Agenda } from '@/components/calendar/Agenda'
import { EmptyState } from '@/components/layout/EmptyState'
import { useFilterState } from '@/hooks/useFilterState'
import { useEventsForWeek } from '@/hooks/useEventsForWeek'
import { startOfIsoWeek, isoDateString } from '@/lib/dates'

function parseIso(s?: string): Date {
  if (!s) return startOfIsoWeek(new Date())
  const d = new Date(s + 'T00:00:00Z')
  return isNaN(d.getTime()) ? startOfIsoWeek(new Date()) : startOfIsoWeek(d)
}

export function CalendarPage() {
  const { isoDate } = useParams()
  const nav = useNavigate()
  const weekStart = useMemo(() => parseIso(isoDate), [isoDate])

  const today = useMemo(() => new Date(), [])
  const isCurrentWeek = isoDateString(weekStart) === isoDateString(startOfIsoWeek(today))
  const [selected, setSelected] = useState<Date>(isCurrentWeek ? today : weekStart)

  const { type, tags, setType, toggleTag, clear } = useFilterState()
  const { events, loading, error } = useEventsForWeek(weekStart, type, tags)

  const goWeek = (offsetDays: number) => {
    const next = new Date(weekStart)
    next.setUTCDate(weekStart.getUTCDate() + offsetDays)
    nav(`/week/${isoDateString(next)}`)
  }

  const densities: Record<string, { type: string; count: number }[]> = {}
  for (const e of events) {
    const k = isoDateString(new Date(e.start_at))
    densities[k] = densities[k] ?? []
    densities[k].push({ type: e.type, count: 1 })
  }

  const eventTags: Record<string, string[]> = {}  // tag join not yet wired client-side

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <TypeTabs value={type} onChange={setType} />
      <div className="mt-2">
        <TagChips selected={tags} onToggle={toggleTag} />
      </div>
      <div className="mt-6">
        <WeekNav weekStart={weekStart} onPrev={() => goWeek(-7)} onNext={() => goWeek(7)} onToday={() => nav('/')} />
        <WeekStrip weekStart={weekStart} selected={selected} onSelect={setSelected} densities={densities} />
      </div>
      <div className="mt-4">
        <DayHero day={selected} />
      </div>
      {error && <EmptyState message="ERROR" hint={error} />}
      {!error && loading && <div className="font-mono text-sm text-muted">Loading…<span className="animate-pulse">▌</span></div>}
      {!error && !loading && events.length === 0 && (
        <EmptyState message="NO EVENTS" hint="Try clearing filters or check back tomorrow." />
      )}
      {!error && !loading && events.length > 0 && (
        <Agenda day={selected} events={events} eventTags={eventTags} />
      )}
      {tags.length > 0 && (
        <button onClick={clear} className="font-mono text-xs underline mt-6">Clear all filters</button>
      )}
    </div>
  )
}
