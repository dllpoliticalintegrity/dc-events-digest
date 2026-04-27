import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/layout/EmptyState'
import type { EventRow } from '@/hooks/useEventsForWeek'

export function EventDetailPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('events').select('*').eq('id', id).maybeSingle(),
      supabase.from('event_tags').select('tag_slug').eq('event_id', id),
    ]).then(([eRes, tRes]) => {
      if (eRes.error) setError(eRes.error.message)
      else setEvent(eRes.data as EventRow | null)
      setTags((tRes.data ?? []).map((r: any) => r.tag_slug))
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="max-w-3xl mx-auto p-6"><Header /><div className="font-mono text-sm text-muted">Loading…</div></div>
  if (error || !event) return <div className="max-w-3xl mx-auto p-6"><Header /><EmptyState message="NOT FOUND" hint="Event missing or unavailable." /></div>

  const start = new Date(event.start_at)
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <Link to="/" className="font-mono text-xs underline">← back</Link>
      <h1 className="font-serif text-3xl font-bold text-ink mt-4">{event.title}</h1>
      <div className="font-mono text-sm text-muted mt-2">
        {start.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </div>
      {event.venue_name && <div className="font-mono text-sm text-muted">{event.venue_name}{event.neighborhood ? ` · ${event.neighborhood}` : ''}</div>}
      {event.cost_text && <div className="font-mono text-sm text-muted">{event.cost_text}</div>}
      {tags.length > 0 && <div className="font-mono text-xs text-muted mt-2">{tags.join(' · ')}</div>}
      {event.description && <p className="font-serif text-base mt-4 leading-relaxed">{event.description}</p>}
      {event.url && (
        <a href={event.url} target="_blank" rel="noreferrer" className="font-mono text-xs underline mt-6 inline-block">
          See source →
        </a>
      )}
    </div>
  )
}
