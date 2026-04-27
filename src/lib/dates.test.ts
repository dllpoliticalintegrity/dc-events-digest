import { describe, it, expect } from 'vitest'
import { startOfIsoWeek, formatWeekRange, sevenDays, formatDayHeading } from './dates'

describe('startOfIsoWeek', () => {
  it('returns Monday for any date in the week', () => {
    // 2026-04-26 is a Sunday; ISO week Monday is 2026-04-20
    const sunday = new Date('2026-04-26T12:00:00Z')
    expect(startOfIsoWeek(sunday).toISOString().slice(0, 10)).toBe('2026-04-20')
  })

  it('returns the same Monday when given a Monday', () => {
    const monday = new Date('2026-04-20T00:00:00Z')
    expect(startOfIsoWeek(monday).toISOString().slice(0, 10)).toBe('2026-04-20')
  })
})

describe('sevenDays', () => {
  it('returns 7 consecutive days starting at the given date', () => {
    const start = new Date('2026-04-20T00:00:00Z')
    const days = sevenDays(start)
    expect(days).toHaveLength(7)
    expect(days[0].toISOString().slice(0, 10)).toBe('2026-04-20')
    expect(days[6].toISOString().slice(0, 10)).toBe('2026-04-26')
  })
})

describe('formatWeekRange', () => {
  it('formats Apr 20 — Apr 26, 2026', () => {
    expect(formatWeekRange(new Date('2026-04-20T00:00:00Z')))
      .toBe('Apr 20 — Apr 26, 2026')
  })
})

describe('formatDayHeading', () => {
  it('formats SUN · APR 26', () => {
    expect(formatDayHeading(new Date('2026-04-26T12:00:00Z')))
      .toBe('SUN · APR 26')
  })
})
