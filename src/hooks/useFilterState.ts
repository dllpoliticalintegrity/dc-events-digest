import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

const TYPES_INCLUDING_ALL = ['all', 'music', 'food', 'arts', 'outdoors', 'civic', 'community'] as const
export type EventType = typeof TYPES_INCLUDING_ALL[number]

export function useFilterState() {
  const [params, setParams] = useSearchParams()

  const type = (TYPES_INCLUDING_ALL as readonly string[]).includes(params.get('type') ?? '')
    ? (params.get('type') as EventType)
    : 'all'

  const tags = (params.get('tags') ?? '').split(',').filter(Boolean)

  const setType = useCallback((t: EventType) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (t === 'all') next.delete('type'); else next.set('type', t)
      return next
    })
  }, [setParams])

  const toggleTag = useCallback((tag: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      const curr = new Set((next.get('tags') ?? '').split(',').filter(Boolean))
      curr.has(tag) ? curr.delete(tag) : curr.add(tag)
      const value = Array.from(curr).join(',')
      if (value) next.set('tags', value); else next.delete('tags')
      return next
    })
  }, [setParams])

  const clear = useCallback(() => setParams(new URLSearchParams()), [setParams])

  return { type, tags, setType, toggleTag, clear }
}
