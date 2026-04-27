import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from './EventCard'

const sample = {
  id: '1', title: 'Jazz in the Garden', start_at: '2026-04-26T21:00:00Z', end_at: null,
  is_all_day: false, type: 'music', venue_name: 'Sculpture Garden', venue_address: null,
  neighborhood: null, url: null, source: 'clockout', source_external_id: 'a',
  cost_text: 'Free', description: null, created_at: '', updated_at: '',
}

describe('EventCard', () => {
  it('renders title, time, venue, cost', () => {
    render(<EventCard event={sample as any} tags={['free', 'outdoor']} onClick={() => {}} />)
    expect(screen.getByText('Jazz in the Garden')).toBeInTheDocument()
    expect(screen.getByText(/Sculpture Garden/)).toBeInTheDocument()
    expect(screen.getByText(/Free/)).toBeInTheDocument()
    expect(screen.getByText(/free/)).toBeInTheDocument()
  })

  it('calls onClick when the card is clicked', () => {
    const onClick = vi.fn()
    render(<EventCard event={sample as any} tags={[]} onClick={onClick} />)
    fireEvent.click(screen.getByText('Jazz in the Garden'))
    expect(onClick).toHaveBeenCalled()
  })
})
