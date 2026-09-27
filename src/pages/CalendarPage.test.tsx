import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { CalendarPage } from './CalendarPage'

vi.mock('@/hooks/useEventsForWeek', () => ({
  useEventsForWeek: () => ({ events: [], loading: false, error: null }),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) } }))

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<><CalendarPage /><LocationProbe /></>} />
        <Route path="/week/:isoDate" element={<><CalendarPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CalendarPage (one week per page)', () => {
  it('renders exactly one week, the one in the URL', () => {
    renderAt('/week/2026-04-22')          // a Wednesday → snaps to its Monday
    expect(document.querySelectorAll('[data-week]')).toHaveLength(1)
    expect(document.querySelector('[data-week]')!.getAttribute('data-week')).toBe('2026-04-20')
  })

  it('next / prev move the URL by a week and keep filters in the query string', () => {
    renderAt('/week/2026-04-20?type=music')
    fireEvent.click(screen.getAllByLabelText('next week')[0])
    expect(screen.getByTestId('loc')).toHaveTextContent('/week/2026-04-27?type=music')
    fireEvent.click(screen.getAllByLabelText('previous week')[0])
    fireEvent.click(screen.getAllByLabelText('previous week')[0])
    expect(screen.getByTestId('loc')).toHaveTextContent('/week/2026-04-13?type=music')
    expect(document.querySelectorAll('[data-week]')).toHaveLength(1)
  })

  it('arrow keys page through weeks', () => {
    renderAt('/week/2026-04-20')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('loc')).toHaveTextContent('/week/2026-04-27')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('loc')).toHaveTextContent('/week/2026-04-20')
  })
})


describe('CalendarPage date picker and filters', () => {
  it('picking a date in the popup jumps to that date\'s week', () => {
    renderAt('/week/2026-04-20')
    fireEvent.click(screen.getAllByLabelText('jump to date')[0])
    fireEvent.click(screen.getByLabelText('next month'))         // April → May
    fireEvent.click(screen.getByTestId('pick-2026-05-14'))     // a Thursday → its Monday
    expect(screen.getByTestId('loc')).toHaveTextContent('/week/2026-05-11')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('no longer shows the tag chip row', () => {
    renderAt('/')
    expect(screen.queryByText('happy-hour')).not.toBeInTheDocument()
    expect(screen.queryByText('ticketed')).not.toBeInTheDocument()
    expect(screen.getByText('Music')).toBeInTheDocument()       // type tabs remain
  })
})
