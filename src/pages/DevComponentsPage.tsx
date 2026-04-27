import { DayHero } from '@/components/calendar/DayHero'
import { WeekStrip } from '@/components/calendar/WeekStrip'
import { WeekNav } from '@/components/calendar/WeekNav'
import { TypeTabs } from '@/components/filters/TypeTabs'
import { TagChips } from '@/components/filters/TagChips'
import { EventCard } from '@/components/calendar/EventCard'
import { EmptyState } from '@/components/layout/EmptyState'
import { Header } from '@/components/layout/Header'
import { useState } from 'react'

const sample = {
  id: '1', title: 'Jazz in the Garden', start_at: '2026-04-26T21:00:00Z', end_at: null,
  is_all_day: false, type: 'music', venue_name: 'Sculpture Garden', venue_address: null,
  neighborhood: null, url: null, source: 'clockout', source_external_id: 'a',
  cost_text: 'Free', description: null, created_at: '', updated_at: '',
}

export function DevComponentsPage() {
  const [type, setType] = useState<any>('all')
  const [tags, setTags] = useState<string[]>([])
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <h2 className="font-mono text-xs text-muted uppercase">— DayHero —</h2>
      <DayHero day={new Date('2026-04-26T12:00:00Z')} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— WeekStrip —</h2>
      <WeekStrip weekStart={new Date('2026-04-20T00:00:00Z')} selected={new Date('2026-04-25T00:00:00Z')} onSelect={() => {}} densities={{ '2026-04-25': [{ type:'music', count:2 }] }} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— WeekNav —</h2>
      <WeekNav weekStart={new Date('2026-04-20T00:00:00Z')} onPrev={() => {}} onNext={() => {}} onToday={() => {}} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— TypeTabs —</h2>
      <TypeTabs value={type} onChange={setType} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— TagChips —</h2>
      <TagChips selected={tags} onToggle={(t) => setTags(s => s.includes(t) ? s.filter(x => x!==t) : [...s, t])} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— EventCard —</h2>
      <EventCard event={sample as any} tags={['free', 'outdoor']} onClick={() => {}} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— EmptyState —</h2>
      <EmptyState message="NO EVENTS" hint="check back tomorrow" />
    </div>
  )
}
