import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeekListPaginated } from './WeekListPaginated'

function ev(id: string, hour: number, title: string, type = 'music') {
  const d = new Date(Date.UTC(2026, 3, 21, hour, 0, 0))
  return {
    id, title, start_at: d.toISOString(), type,
    end_at: null, is_all_day: false, venue_name: null, venue_address: null,
    neighborhood: null, url: null, source: 's', source_external_id: id,
    cost_text: null, description: null, created_at: '', updated_at: '',
  }
}

describe('WeekListPaginated', () => {
  it('renders nothing when events list is empty', () => {
    const { container } = render(<MemoryRouter><WeekListPaginated events={[]} onSelectEvent={() => {}} /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })

  it('shows up to 10 rows on the first page and a count header', () => {
    const events = Array.from({length: 15}, (_, i) => ev(`e${i}`, 9 + i, `Event ${i+1}`))
    render(<MemoryRouter><WeekListPaginated events={events as any} onSelectEvent={() => {}} /></MemoryRouter>)
    expect(screen.getByText(/ALL THIS WEEK · 15 EVENTS/)).toBeInTheDocument()
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(screen.getByText('Event 10')).toBeInTheDocument()
    expect(screen.queryByText('Event 11')).not.toBeInTheDocument()
    expect(screen.getByText('page 1 of 2')).toBeInTheDocument()
  })

  it('paginates next + prev correctly', () => {
    const events = Array.from({length: 23}, (_, i) => ev(`e${i}`, 9, `Event ${i+1}`))
    render(<MemoryRouter><WeekListPaginated events={events as any} onSelectEvent={() => {}} /></MemoryRouter>)
    expect(screen.getByText('page 1 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('next page'))
    expect(screen.getByText('Event 11')).toBeInTheDocument()
    expect(screen.getByText('Event 20')).toBeInTheDocument()
    expect(screen.getByText('page 2 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('next page'))
    expect(screen.getByText('Event 21')).toBeInTheDocument()
    expect(screen.getByText('page 3 of 3')).toBeInTheDocument()
    // next disabled on last page
    expect(screen.getByLabelText('next page')).toBeDisabled()
    // prev brings us back
    fireEvent.click(screen.getByLabelText('previous page'))
    expect(screen.getByText('page 2 of 3')).toBeInTheDocument()
  })

  it('calls onSelectEvent when a row is clicked', () => {
    const onSelect = vi.fn()
    render(<MemoryRouter><WeekListPaginated events={[ev('abc', 17, 'Talk')] as any} onSelectEvent={onSelect} /></MemoryRouter>)
    fireEvent.click(screen.getByText('Talk'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }))
  })

  it('shows "1 EVENT" (singular) when there is exactly one event', () => {
    render(<MemoryRouter><WeekListPaginated events={[ev('a', 9, 'Solo')] as any} onSelectEvent={() => {}} /></MemoryRouter>)
    expect(screen.getByText(/ALL THIS WEEK · 1 EVENT$/)).toBeInTheDocument()
  })
})
