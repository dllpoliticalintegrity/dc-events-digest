import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Agenda } from './Agenda'

const events = [
  { id: '1', title: 'Show A', start_at: '2026-04-26T17:00:00Z', type: 'music', source: 'clockout', source_external_id: 'a', is_all_day: false, venue_name: 'V1', venue_address: null, neighborhood: null, url: null, cost_text: null, description: null, end_at: null, created_at: '', updated_at: '' },
]

describe('Agenda', () => {
  it('shows day heading + event count', () => {
    render(<MemoryRouter><Agenda day={new Date('2026-04-26T12:00:00Z')} events={events as any} eventTags={{}} /></MemoryRouter>)
    expect(screen.getByText(/SUN · APR 26/)).toBeInTheDocument()
    expect(screen.getByText(/1 EVENT/)).toBeInTheDocument()
    expect(screen.getByText('Show A')).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    render(<MemoryRouter><Agenda day={new Date('2026-04-26T12:00:00Z')} events={[] as any} eventTags={{}} /></MemoryRouter>)
    expect(screen.getByText(/No events match/i)).toBeInTheDocument()
  })
})
