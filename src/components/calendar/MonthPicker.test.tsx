import { describe, it, expect } from 'vitest'
import { monthGrid, isoDateString } from '@/lib/dates'

describe('monthGrid', () => {
  it('starts on the Monday on or before the 1st and covers the whole month', () => {
    const rows = monthGrid(2026, 3)               // April 2026 starts on a Wednesday
    expect(rows[0].map(isoDateString)).toEqual(['2026-03-30','2026-03-31','2026-04-01','2026-04-02','2026-04-03','2026-04-04','2026-04-05'])
    expect(rows).toHaveLength(5)
    expect(isoDateString(rows[4][6])).toBe('2026-05-03')
  })

  it('handles a month that starts on Monday without a leading padding week', () => {
    const rows = monthGrid(2026, 5)               // June 1 2026 is a Monday
    expect(isoDateString(rows[0][0])).toBe('2026-06-01')
    expect(rows).toHaveLength(5)
  })
})
