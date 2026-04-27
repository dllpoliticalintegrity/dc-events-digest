import { useState, useMemo } from 'react'
import type { EventRow } from '@/hooks/useEventsForWeek'
import { formatTime } from '@/lib/dates'
import { sourceLabel } from '@/lib/sourceLabels'

const PAGE_SIZE = 10
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const TYPE_BORDER: Record<string, string> = {
  music: 'border-l-stamp',
  food: 'border-l-yellow-600',
  arts: 'border-l-purple-600',
  outdoors: 'border-l-green-700',
  civic: 'border-l-blue-700',
  community: 'border-l-gray-500',
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const dow = DAYS_SHORT[d.getDay()]
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${dow} ${month}/${day}`
}

export function WeekListPaginated({ events, onSelectEvent }: { events: EventRow[]; onSelectEvent: (e: EventRow) => void }) {
  const [page, setPage] = useState(0)

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [events]
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  if (events.length === 0) return null

  return (
    <section className="mt-10">
      <div className="font-mono text-xs text-muted my-3 tracking-widest border-t border-gray-300 pt-4">
        — ALL THIS WEEK · {events.length} EVENT{events.length === 1 ? '' : 'S'}
      </div>

      <ul className="space-y-1">
        {slice.map(e => {
          const border = TYPE_BORDER[e.type] ?? 'border-l-gray-400'
          return (
            <li key={e.id}>
              <button
                onClick={() => onSelectEvent(e)}
                className={`flex items-baseline gap-3 w-full text-left bg-white border border-gray-300 ${border} border-l-[3px] px-3 py-2 hover:bg-paper`}
              >
                <span className="font-mono text-[11px] text-muted whitespace-nowrap min-w-[80px]">
                  {formatDayLabel(e.start_at)}
                </span>
                <span className="font-mono text-[11px] text-muted whitespace-nowrap min-w-[48px]">
                  {formatTime(e.start_at)}
                </span>
                <span className="font-serif text-sm text-ink flex-1 truncate">{e.title}</span>
                <span className="font-mono text-[10px] text-muted uppercase whitespace-nowrap hidden sm:inline">
                  {e.type}
                </span>
                <span className="font-mono text-[10px] text-muted whitespace-nowrap hidden md:inline">
                  · {sourceLabel(e.source)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between mt-4 font-mono text-xs">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="underline disabled:no-underline disabled:text-muted/50"
            aria-label="previous page"
          >
            ◂ prev
          </button>
          <span className="text-muted">page {safePage + 1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="underline disabled:no-underline disabled:text-muted/50"
            aria-label="next page"
          >
            next ▸
          </button>
        </nav>
      )}
    </section>
  )
}
