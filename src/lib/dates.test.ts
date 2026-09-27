import { describe, it, expect } from 'vitest'
import {
  startOfIsoWeek, sevenDays, formatWeekRange, formatDayHeading, isoDateString,
  localDateKey, localMidnightIso, dayStamp, addDays, todayStamp,
} from './dates'

describe('dates', () => {
  it('startOfIsoWeek returns the Monday for any day of the week', () => {
    expect(isoDateString(startOfIsoWeek(new Date('2026-04-26T12:00:00Z')))).toBe('2026-04-20') // Sunday → Monday before
    expect(isoDateString(startOfIsoWeek(new Date('2026-04-20T00:00:00Z')))).toBe('2026-04-20') // Monday stays
    expect(isoDateString(startOfIsoWeek(new Date('2026-04-23T23:59:59Z')))).toBe('2026-04-20') // Thursday
  })

  it('sevenDays yields Mon..Sun', () => {
    const days = sevenDays(new Date('2026-04-20T00:00:00Z')).map(isoDateString)
    expect(days).toEqual(['2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24','2026-04-25','2026-04-26'])
  })

  it('formats week ranges and day headings', () => {
    expect(formatWeekRange(new Date('2026-04-20T00:00:00Z'))).toBe('Apr 20 — Apr 26, 2026')
    expect(formatWeekRange(new Date('2026-12-28T00:00:00Z'))).toBe('Dec 28 — Jan 3, 2027')
    expect(formatDayHeading(new Date('2026-04-22T00:00:00Z'))).toBe('WED · APR 22')
  })

  it('localDateKey groups an instant by the viewer\'s local calendar day', () => {
    const lateLocal = new Date(2026, 3, 22, 23, 30)   // 11:30pm local on Apr 22
    expect(localDateKey(lateLocal.toISOString())).toBe('2026-04-22')
    expect(localDateKey(new Date(2026, 3, 23, 0, 5).toISOString())).toBe('2026-04-23')
  })

  it('localMidnightIso converts a day stamp to the local midnight instant', () => {
    const stamp = dayStamp(2026, 3, 20)
    expect(new Date(localMidnightIso(stamp)).getTime()).toBe(new Date(2026, 3, 20).getTime())
  })

  it('addDays and todayStamp work on UTC day stamps', () => {
    expect(isoDateString(addDays(dayStamp(2026, 3, 30), 1))).toBe('2026-05-01')
    const now = new Date(2026, 3, 22, 23, 59)
    expect(isoDateString(todayStamp(now))).toBe('2026-04-22')
  })
})
