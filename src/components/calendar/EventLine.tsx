import type { EventRow } from '@/hooks/useEventsForWeek'
import { formatTime } from '@/lib/dates'
import { sourceLabel } from '@/lib/sourceLabels'

const TYPE_BORDER: Record<string, string> = {
  music: 'border-l-stamp',
  food: 'border-l-yellow-600',
  arts: 'border-l-purple-600',
  outdoors: 'border-l-green-700',
  civic: 'border-l-blue-700',
  community: 'border-l-gray-500',
}

/** One compact row in the day list: time · title · venue · type · source. */
export function EventLine({ event, onClick }: { event: EventRow; onClick: () => void }) {
  const border = TYPE_BORDER[event.type] ?? 'border-l-gray-400'
  const time = event.is_all_day ? 'all day' : formatTime(event.start_at)
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex items-baseline gap-3 w-full text-left bg-white border border-gray-300 ${border} border-l-[3px] px-3 py-2 hover:bg-paper`}
      >
        <span className="font-mono text-[11px] text-muted whitespace-nowrap min-w-[52px]">{time}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-serif text-sm text-ink truncate">{event.title}</span>
          {(event.venue_name || event.cost_text) && (
            <span className="block font-mono text-[10px] text-muted truncate">
              {[event.venue_name, event.cost_text].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className="font-mono text-[10px] text-muted uppercase whitespace-nowrap hidden sm:inline">
          {event.type}
        </span>
        <span className="font-mono text-[10px] text-muted whitespace-nowrap hidden md:inline">
          · {sourceLabel(event.source)}
        </span>
      </button>
    </li>
  )
}
