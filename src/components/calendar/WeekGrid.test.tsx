// src/components/calendar/WeekGrid.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeekGrid } from './WeekGrid'

const monday = new Date('2026-04-20T00:00:00Z')

function ev(id: string, day: number, hourUtc: number, title: string, type = 'music') {
  const d = new Date(Date.UTC(2026, 3, day, hourUtc, 0, 0))
  return {
    id, title, start_at: d.toISOString(), type,
    end_at: null, is_all_day: false, venue_name: null, venue_address: null,
    neighborhood: null, url: null, source: 's', source_external_id: id,
    cost_text: null, description: null, created_at: '', updated_at: '',
  }
}

describe('WeekGrid', () => {
  it('renders 7 day-column headers (Mon–Sun)', () => {
    render(<MemoryRouter><WeekGrid weekStart={monday} events={[]} eventTags={{}} onSelectEvent={() => {}} /></MemoryRouter>)
    ;['MON','TUE','WED','THU','FRI','SAT','SUN'].forEach(d => {
      expect(screen.getByText(d)).toBeInTheDocument()
    })
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument()
  })

  it('shows up to 5 events per day; surfaces "+N more" when there are >5', () => {
    const events = Array.from({length: 7}, (_, i) => ev(`e${i}`, 21, 17, `Event ${i+1}`))  // 7 events on Apr 21
    render(<MemoryRouter><WeekGrid weekStart={monday} events={events as any} eventTags={{}} onSelectEvent={() => {}} /></MemoryRouter>)
    // Five visible
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(screen.getByText('Event 5')).toBeInTheDocument()
    // The 6th and 7th are NOT yet shown
    expect(screen.queryByText('Event 6')).not.toBeInTheDocument()
    // "+2 more" button
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('clicking "+N more" expands the column to show all events', () => {
    const events = Array.from({length: 7}, (_, i) => ev(`e${i}`, 21, 17, `Event ${i+1}`))
    render(<MemoryRouter><WeekGrid weekStart={monday} events={events as any} eventTags={{}} onSelectEvent={() => {}} /></MemoryRouter>)
    fireEvent.click(screen.getByText('+2 more'))
    expect(screen.getByText('Event 6')).toBeInTheDocument()
    expect(screen.getByText('Event 7')).toBeInTheDocument()
    expect(screen.getByText('show less')).toBeInTheDocument()
  })

  it('calls onSelectEvent when chip is clicked', () => {
    const onSelect = vi.fn()
    const events = [ev('abc', 22, 19, 'Talk Show')]
    render(<MemoryRouter><WeekGrid weekStart={monday} events={events as any} eventTags={{}} onSelectEvent={onSelect} /></MemoryRouter>)
    fireEvent.click(screen.getByText('Talk Show'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }))
  })

  it('shows an em-dash placeholder for empty days', () => {
    render(<MemoryRouter><WeekGrid weekStart={monday} events={[]} eventTags={{}} onSelectEvent={() => {}} /></MemoryRouter>)
    // 7 placeholders (one per day column)
    expect(screen.getAllByText('—')).toHaveLength(7)
  })
})
