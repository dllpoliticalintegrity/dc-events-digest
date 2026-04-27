const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']

export function formatTime(iso: string): string {
  const local = new Date(iso)
  const h = local.getHours()
  const m = local.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

export function startOfIsoWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = x.getUTCDay() // 0=Sun
  const daysFromMonday = (dow + 6) % 7
  x.setUTCDate(x.getUTCDate() - daysFromMonday)
  return x
}

export function sevenDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    return d
  })
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} — ${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
}

export function formatDayHeading(d: Date): string {
  return `${DAYS_SHORT[d.getUTCDay()]} · ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()}`
}

export function isoDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}
