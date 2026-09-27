import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { TypeTabs } from '@/components/filters/TypeTabs'
import { TagChips } from '@/components/filters/TagChips'
import { WeekPager } from '@/components/calendar/WeekPager'
import { WeekSection } from '@/components/calendar/WeekSection'
import { EventDetailModal } from '@/components/calendar/EventDetailModal'
import { useFilterState } from '@/hooks/useFilterState'
import type { EventRow } from '@/hooks/useEventsForWeek'
import { startOfIsoWeek, isoDateString, todayStamp, addDays } from '@/lib/dates'

function parseWeek(s?: string): Date {
  const thisWeek = startOfIsoWeek(todayStamp())
  if (!s) return thisWeek
  const d = new Date(s + 'T00:00:00Z')
  return isNaN(d.getTime()) ? thisWeek : startOfIsoWeek(d)
}

/**
 * One week per page. The week in view is the URL (`/week/:isoDate`), so
 * prev/next update the address bar and every week is linkable; the days of
 * that week stack vertically below with their events.
 */
export function CalendarPage() {
  const { isoDate } = useParams()
  const nav = useNavigate()
  const { search } = useLocation()
  const weekStart = useMemo(() => parseWeek(isoDate), [isoDate])
  const thisWeek = isoDateString(startOfIsoWeek(todayStamp()))
  const isCurrentWeek = isoDateString(weekStart) === thisWeek

  const { type, tags, setType, toggleTag, clear } = useFilterState()
  const hasFilters = type !== 'all' || tags.length > 0
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null)

  const goToWeek = useCallback((target: Date) => {
    const iso = isoDateString(target)
    nav({ pathname: iso === thisWeek ? '/' : `/week/${iso}`, search })  // filters live in the query string
    window.scrollTo({ top: 0 })
  }, [nav, thisWeek, search])
  const goPrev = useCallback(() => goToWeek(addDays(weekStart, -7)), [goToWeek, weekStart])
  const goNext = useCallback(() => goToWeek(addDays(weekStart, 7)), [goToWeek, weekStart])
  const goToday = useCallback(() => goToWeek(startOfIsoWeek(todayStamp())), [goToWeek])

  // ← / → page through weeks unless the user is typing or the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openEvent || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, openEvent])

  const pagerProps = { weekStart, isCurrentWeek, onPrev: goPrev, onNext: goNext, onToday: goToday }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <TypeTabs value={type} onChange={setType} />
      <div className="mt-2">
        <TagChips selected={tags} onToggle={toggleTag} />
      </div>
      {hasFilters && (
        <button onClick={clear} className="font-mono text-xs underline mt-2 text-muted hover:text-ink">Clear all filters</button>
      )}

      <div className="mt-6">
        <WeekPager {...pagerProps} />
      </div>

      <div className="mt-3">
        <WeekSection
          key={isoDateString(weekStart)}
          weekStart={weekStart}
          type={type}
          tags={tags}
          hasFilters={hasFilters}
          onClearFilters={clear}
          onSelectEvent={setOpenEvent}
        />
      </div>

      <div className="mt-8 mb-10">
        <WeekPager {...pagerProps} compact />
      </div>

      <EventDetailModal event={openEvent} onClose={() => setOpenEvent(null)} />
    </div>
  )
}
