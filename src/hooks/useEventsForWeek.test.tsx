import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useEventsForWeek } from './useEventsForWeek'

// Mock the supabase module before the hook imports it
vi.mock('@/lib/supabase', () => {
  const eq = vi.fn().mockReturnThis()
  const gte = vi.fn().mockReturnThis()
  const lt = vi.fn().mockReturnThis()
  const order = vi.fn().mockReturnThis()
  const select = vi.fn().mockReturnThis()
  const queryFn = { select, eq, gte, lt, order, then: undefined as any }
  // .then resolves the chain
  ;(queryFn as any).then = (resolve: any) =>
    Promise.resolve({
      data: [
        { id: '1', title: 'A', start_at: '2026-04-26T17:00:00Z', type: 'music', source: 'clockout', source_external_id: 'a', is_all_day: false, venue_name: null, neighborhood: null, url: null, cost_text: null, description: null, end_at: null, created_at: '', updated_at: '' },
      ],
      error: null,
    }).then(resolve)
  return { supabase: { from: () => queryFn } }
})

beforeEach(() => vi.clearAllMocks())

describe('useEventsForWeek', () => {
  it('returns events on success', async () => {
    const monday = new Date('2026-04-20T00:00:00Z')
    const { result } = renderHook(() => useEventsForWeek(monday, 'all', []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0].title).toBe('A')
  })
})
