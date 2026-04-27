import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventDetailModal } from './EventDetailModal'

vi.mock('@/lib/supabase', () => {
  const eq = vi.fn(() => Promise.resolve({ data: [{ tag_slug: 'free' }], error: null }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { supabase: { from } }
})

const sample = {
  id: 'evt1', title: 'Cherry Blossom Concert', start_at: '2026-04-26T21:00:00Z',
  end_at: null, is_all_day: false, type: 'music',
  venue_name: 'Tidal Basin', venue_address: null, neighborhood: 'NW',
  url: 'https://example.test/show', source: 'clockout', source_external_id: 'a',
  cost_text: 'Free', description: 'Closing concert for the festival.',
  created_at: '', updated_at: '',
}

describe('EventDetailModal', () => {
  it('renders nothing when event is null', () => {
    const { container } = render(<EventDetailModal event={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders title, dateline, venue, type, source link', async () => {
    render(<EventDetailModal event={sample as any} onClose={() => {}} />)
    expect(screen.getByText('Cherry Blossom Concert')).toBeInTheDocument()
    expect(screen.getByText(/Tidal Basin/)).toBeInTheDocument()
    expect(screen.getByText(/NW/)).toBeInTheDocument()
    expect(screen.getByText(/Free/)).toBeInTheDocument()
    expect(screen.getByText(/Closing concert/)).toBeInTheDocument()
    expect(screen.getByText(/via Clockout DC/)).toBeInTheDocument()
    const sourceLink = screen.getByText(/See source/).closest('a')
    expect(sourceLink).toHaveAttribute('href', 'https://example.test/show')
    expect(sourceLink).toHaveAttribute('target', '_blank')
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<EventDetailModal event={sample as any} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does NOT call onClose when the dialog body is clicked', () => {
    const onClose = vi.fn()
    render(<EventDetailModal event={sample as any} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on the X button', () => {
    const onClose = vi.fn()
    render(<EventDetailModal event={sample as any} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "no source link" when event has no url', () => {
    const noUrl = { ...sample, url: null }
    render(<EventDetailModal event={noUrl as any} onClose={() => {}} />)
    expect(screen.getByText(/no source link/)).toBeInTheDocument()
  })
})
