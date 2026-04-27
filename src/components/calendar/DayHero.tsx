const FULL_DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

export function DayHero({ day }: { day: Date }) {
  return (
    <div className="inline-block bg-white border border-gray-400 shadow-[2px_2px_0_#cc3333,3px_3px_8px_rgba(0,0,0,0.15)] text-center mb-4">
      <div className="bg-stamp text-white font-mono text-xs tracking-[0.2em] py-1 px-3">
        {FULL_DAYS[day.getUTCDay()]}
      </div>
      <div className="font-serif text-7xl font-bold text-ink leading-none px-6 py-3">
        {day.getUTCDate()}
      </div>
      <div className="border-t border-dashed border-gray-400 font-mono text-[10px] text-muted py-1 tracking-widest">
        {MONTHS[day.getUTCMonth()]} · {day.getUTCFullYear()}
      </div>
    </div>
  )
}
