const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export function formatTime(iso: string): string {
  const local = new Date(iso)
  const h = local.getHours()
  const m = local.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

/**
 * Calendar days are represented as Dates at UTC midnight ("day stamps"), e.g.
 * 2026-04-20T00:00:00Z means "April 20" regardless of the viewer's timezone.
 * Event instants are grouped onto day stamps by their *local* calendar date,
 * so a 10pm ET show (02:00 UTC next day) stays on the evening it happens.
 */
export function dayStamp(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d))
}

/** The viewer's local calendar date for an instant, as a day stamp. */
export function localDayStamp(instant: Date): Date {
  return dayStamp(instant.getFullYear(), instant.getMonth(), instant.getDate())
}

/** Today's local calendar date as a day stamp. */
export function todayStamp(now: Date = new Date()): Date {
  return localDayStamp(now)
}

/** 'YYYY-MM-DD' of an instant in the viewer's local timezone. */
export function localDateKey(iso: string): string {
  return isoDateString(localDayStamp(new Date(iso)))
}

/** ISO instant of local midnight at the start of the given day stamp. */
export function localMidnightIso(stamp: Date): string {
  return new Date(stamp.getUTCFullYear(), stamp.getUTCMonth(), stamp.getUTCDate()).toISOString()
}

export function startOfIsoWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = x.getUTCDay() // 0=Sun
  const daysFromMonday = (dow + 6) % 7
  x.setUTCDate(x.getUTCDate() - daysFromMonday)
  return x
}

export function addDays(stamp: Date, days: number): Date {
  const d = new Date(stamp)
  d.setUTCDate(stamp.getUTCDate() + days)
  return d
}

export function sevenDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  return `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} — ${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
}

export function formatDayHeading(d: Date): string {
  return `${DAYS_SHORT[d.getUTCDay()]} · ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()}`
}

export function formatDayLong(d: Date): string {
  return `${DAYS_LONG[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function isoDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Rows of 7 UTC day stamps covering a month, Monday-first, padded to full weeks. */
export function monthGrid(year: number, month: number): Date[][] {
  const first = startOfIsoWeek(dayStamp(year, month, 1))
  const lastOfMonth = dayStamp(year, month + 1, 0)
  const rows: Date[][] = []
  for (let d = first; d <= lastOfMonth; d = addDays(d, 7)) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
  }
  return rows
}
