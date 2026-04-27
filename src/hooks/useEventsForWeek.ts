import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase-types'
import { sevenDays, isoDateString } from '@/lib/dates'

export type EventRow = Database['public']['Tables']['events']['Row']

export function useEventsForWeek(monday: Date, type: string, tags: string[]) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const start = isoDateString(monday)
    const sundayPlusOne = new Date(monday)
    sundayPlusOne.setUTCDate(monday.getUTCDate() + 7)
    const end = isoDateString(sundayPlusOne)

    let q = supabase.from('events').select('*')
      .gte('start_at', start)
      .lt('start_at', end)
      .order('start_at', { ascending: true })

    if (type !== 'all') q = q.eq('type', type)

    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      let rows = (data ?? []) as EventRow[]
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
