import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EventRow } from '@/hooks/useEventsForWeek'
import { sourceLabel } from '@/lib/sourceLabels'

export function EventDetailModal({
  event, onClose,
}: {
  event: EventRow | null
  onClose: () => void
}) {
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    if (!event) { setTags([]); return }
    supabase.from('event_tags').select('tag_slug').eq('event_id', event.id)
      .then(res => setTags((res.data ?? []).map((r: any) => r.tag_slug)))
  }, [event?.id])

  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [event, onClose])

  if (!event) return null

  const start = new Date(event.start_at)
  const dateline = start.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <div
      data-testid="modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-40 bg-black/40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border-2 border-ink shadow-[4px_4px_0_#cc3333,8px_8px_24px_rgba(0,0,0,0.25)] max-w-2xl w-full p-6 mt-12 relative"
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute top-2 right-3 font-mono text-2xl text-muted hover:text-stamp"
        >
          ×
        </button>

        <h2 className="font-serif text-2xl font-bold text-ink pr-8">{event.title}</h2>

        <div className="font-mono text-xs text-muted mt-2 tracking-wider">{dateline}</div>

        {event.venue_name && (
          <div className="font-mono text-xs text-muted mt-1">
            {event.venue_name}{event.neighborhood ? ` · ${event.neighborhood}` : ''}
          </div>
        )}

        {event.cost_text && (
          <div className="font-mono text-xs text-muted mt-1">{event.cost_text}</div>
        )}

        <div className="font-mono text-[10px] text-muted uppercase mt-2">
          {event.type}{tags.length > 0 ? ` · ${tags.join(' · ')}` : ''}
        </div>

        <div className="font-mono text-[10px] text-muted mt-1">
          via {sourceLabel(event.source)}
        </div>

        {event.description && (
          <p className="font-serif text-base mt-4 leading-relaxed">{event.description}</p>
        )}

        <div className="mt-6 pt-4 border-t border-gray-300">
          {event.url ? (
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm underline text-stamp hover:text-ink"
            >
              See source →
            </a>
          ) : (
            <span className="font-mono text-xs text-muted">no source link</span>
          )}
        </div>
      </div>
    </div>
  )
}
