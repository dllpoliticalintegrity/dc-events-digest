import { useEffect, useMemo, useRef, useState } from 'react'
import { dayStamp, addDays, isoDateString, todayStamp, monthGrid } from '@/lib/dates'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['M','T','W','T','F','S','S']

export interface MonthPickerProps {
  /** Monday (UTC day stamp) of the week currently shown; its 7 days are highlighted. */
  weekStart: Date
  onPick: (day: Date) => void
  onClose: () => void
}

/** Month grid popup: click any day to jump to the week that contains it. */
export function MonthPicker({ weekStart, onPick, onClose }: MonthPickerProps) {
  const [view, setView] = useState({ y: weekStart.getUTCFullYear(), m: weekStart.getUTCMonth() })
  const ref = useRef<HTMLDivElement>(null)
  const today = isoDateString(todayStamp())
  const weekDays = useMemo(() => new Set(Array.from({ length: 7 }, (_, i) => isoDateString(addDays(weekStart, i)))), [weekStart])
  const rows = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey)
    // Register after the opening click has finished bubbling.
    const id = window.setTimeout(() => window.addEventListener('mousedown', onClick), 0)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id); window.removeEventListener('mousedown', onClick) }
  }, [onClose])

  const shift = (delta: number) => setView(v => {
    const d = dayStamp(v.y, v.m + delta, 1)
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
  })

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="jump to date"
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 w-[280px] bg-paper border-2 border-ink shadow-[4px_4px_0_#cc3333,8px_8px_24px_rgba(0,0,0,0.2)] p-3 font-mono text-xs"
    >
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => shift(-1)} aria-label="previous month" className="px-2 py-0.5 hover:text-stamp">◂</button>
        <div className="font-serif text-sm font-bold text-ink">{MONTHS[view.m]} {view.y}</div>
        <button onClick={() => shift(1)} aria-label="next month" className="px-2 py-0.5 hover:text-stamp">▸</button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] text-muted mb-1">
        {DOW.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {rows.flat().map(day => {
          const key = isoDateString(day)
          const inMonth = day.getUTCMonth() === view.m
          const isToday = key === today
          const inWeek = weekDays.has(key)
          return (
            <button
              key={key}
              data-testid={`pick-${key}`}
              onClick={() => onPick(day)}
              aria-label={`jump to week of ${key}`}
              className={[
                'h-8 text-center hover:bg-white',
                inWeek ? 'bg-white border-y border-stamp/60' : '',
                isToday ? 'text-stamp font-semibold underline' : inMonth ? 'text-ink' : 'text-muted/50',
              ].join(' ')}
            >
              {day.getUTCDate()}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <button onClick={() => onPick(todayStamp())} className="underline hover:text-stamp">Today</button>
        <span>click a day to open its week</span>
      </div>
    </div>
  )
}
