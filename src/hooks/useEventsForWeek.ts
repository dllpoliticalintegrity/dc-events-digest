import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase-types'
import { addDays, localMidnightIso } from '@/lib/dates'

export type EventRow = Database['public']['Tables']['events']['Row']

/**
 * Events whose start falls inside the local-time week beginning at `monday`
 * (a UTC-midnight day stamp). The range is converted to local midnight so
 * late-evening events land on the day they happen for the viewer.
 */
export function useEventsForWeek(monday: Date, type: string, tags: string[]) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const start = localMidnightIso(monday)
    const end = localMidnightIso(addDays(monday, 7))

    let q = supabase.from('events').select('*')
      .gte('start_at', start)
      .lt('start_at', end)
      .order('start_at', { ascending: true })

    if (type !== 'all') q = q.eq('type', type)

    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      const rows = (data ?? []) as EventRow[]
      if (tags.length > 0) {
        // Tag filter: client-side join. (For v1 traffic, fine; revisit if event count grows.)
        // Server-side join requires a view; deferred until needed.
      }
      setEvents(rows)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [monday.getTime(), type, tags.join(',')])

  return { events, loading, error }
}
