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

export function EventCard({
  event, tags, onClick,
}: {
  event: EventRow; tags: string[]; onClick: () => void
}) {
  const border = TYPE_BORDER[event.type] ?? 'border-l-gray-400'
  const meta = [
    formatTime(event.start_at),
    event.venue_name ?? null,
    event.cost_text ?? null,
  ].filter(Boolean).join(' · ')
  return (
    <button onClick={onClick} className="block w-full text-left">
      <div className={`bg-white border border-gray-300 ${border} border-l-[3px] p-3 mb-2 hover:bg-paper`}>
        <div className="font-serif text-base font-semibold text-ink">{event.title}</div>
        <div className="font-mono text-xs text-muted mt-1">{meta}</div>
        {tags.length > 0 && (
          <div className="font-mono text-[10px] text-muted mt-1">{tags.join(' · ')}</div>
        )}
        <div className="font-mono text-[10px] text-muted mt-1 uppercase">
          via {sourceLabel(event.source)}
        </div>
      </div>
    </button>
  )
}
