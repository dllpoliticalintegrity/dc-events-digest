import { useEffect, useRef, useState } from 'react'
import type { EventRow } from '@/hooks/useEventsForWeek'
import { addDays, isoDateString } from '@/lib/dates'
import { WeekSection } from './WeekSection'

export const INITIAL_WEEKS = 2
export const MAX_WEEKS_AHEAD = 26
export const MAX_WEEKS_BACK = 26

export interface WeekFeedProps {
  anchorWeek: Date            // first week shown on load (UTC-midnight Monday)
  type: string
  tags: string[]
  hasFilters: boolean
  onClearFilters: () => void
  onSelectEvent: (e: EventRow) => void
}

/**
 * Vertical, week-paginated calendar. Weeks stack top to bottom; scrolling to
 * the bottom appends the next week (IntersectionObserver, with a button
 * fallback), and "earlier week" prepends one above without moving the view.
 */
export function WeekFeed({ anchorWeek, type, tags, hasFilters, onClearFilters, onSelectEvent }: WeekFeedProps) {
  const [before, setBefore] = useState(0)
  const [after, setAfter] = useState(INITIAL_WEEKS - 1)
  const sentinel = useRef<HTMLDivElement>(null)
  // The page keys this component by anchor week, so a new anchor remounts it
  // with a fresh window instead of resetting state in an effect.

  const canLoadLater = after < MAX_WEEKS_AHEAD
  const canLoadEarlier = before < MAX_WEEKS_BACK

  useEffect(() => {
    const el = sentinel.current
    if (!el || !canLoadLater || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) setAfter(n => Math.min(MAX_WEEKS_AHEAD, n + 1))
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [canLoadLater, after])

  const loadEarlier = () => {
    // Keep the viewport anchored on the same content when a week is prepended.
    const doc = document.documentElement
    const prevHeight = doc.scrollHeight
    setBefore(n => Math.min(MAX_WEEKS_BACK, n + 1))
    requestAnimationFrame(() => {
      const delta = doc.scrollHeight - prevHeight
      if (delta > 0) window.scrollBy({ top: delta })
    })
  }

  const weeks: Date[] = []
  for (let i = -before; i <= after; i++) weeks.push(addDays(anchorWeek, i * 7))

  return (
    <div className="mt-4">
      <div className="flex justify-center mb-3">
        <button
          onClick={loadEarlier}
          disabled={!canLoadEarlier}
          className="font-mono text-xs underline text-muted hover:text-ink disabled:no-underline disabled:text-muted/50"
        >
          ▴ earlier week
        </button>
      </div>

      <div className="space-y-10">
        {weeks.map(w => (
          <WeekSection
            key={isoDateString(w)}
            weekStart={w}
            type={type}
            tags={tags}
            hasFilters={hasFilters}
            onClearFilters={onClearFilters}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </div>

      <div ref={sentinel} data-testid="feed-sentinel" className="h-px" />
      <div className="flex justify-center mt-6 mb-10">
        {canLoadLater ? (
          <button
            onClick={() => setAfter(n => Math.min(MAX_WEEKS_AHEAD, n + 1))}
            className="font-mono text-xs underline text-muted hover:text-ink"
          >
            ▾ next week
          </button>
        ) : (
          <span className="font-mono text-xs text-muted/70">— end of listings —</span>
        )}
      </div>
    </div>
  )
}
