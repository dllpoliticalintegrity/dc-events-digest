import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentProps } from 'react'
import { WeekSection } from './WeekSection'
import type { EventRow } from '@/hooks/useEventsForWeek'

const hook = vi.fn<() => { events: EventRow[]; loading: boolean; error: string | null }>()
vi.mock('@/hooks/useEventsForWeek', () => ({ useEventsForWeek: () => hook() }))

const monday = new Date('2026-04-20T00:00:00Z')

function ev(id: string, isoStart: string, title: string, extra: Partial<EventRow> = {}): EventRow {
  return {
    id, title, start_at: isoStart, type: 'music',
    end_at: null, is_all_day: false, venue_name: null, venue_address: null,
    neighborhood: null, url: null, source: 'clockout', source_external_id: id,
    cost_text: null, description: null, created_at: '', updated_at: '', ...extra,
  }
}

function renderSection(props: Partial<ComponentProps<typeof WeekSection>> = {}) {
  return render(
    <MemoryRouter>
      <WeekSection weekStart={monday} type="all" tags={[]} hasFilters={false} onClearFilters={() => {}} onSelectEvent={() => {}} {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => hook.mockReset())

describe('WeekSection', () => {
  it('renders the week header and all seven day headings in order', () => {
    hook.mockReturnValue({ events: [], loading: false, error: null })
    renderSection()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Apr 20 — Apr 26, 2026')
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings[0]).toContain('MON · APR 20')
    expect(headings[6]).toContain('SUN · APR 26')
    expect(screen.getAllByText('— nothing listed')).toHaveLength(7)
    expect(screen.getByText('0 EVENTS')).toBeInTheDocument()
  })

  it('groups events onto their local calendar day and sorts by time', () => {
    // 2026-04-22 is a Wednesday; two events on it, one late-evening local.
    const late = new Date(2026, 3, 22, 22, 30).toISOString()   // 10:30pm local Wed
    const early = new Date(2026, 3, 22, 9, 0).toISOString()    // 9am local Wed
    hook.mockReturnValue({ events: [ev('a', late, 'Late Show'), ev('b', early, 'Morning Market')], loading: false, error: null })
    renderSection()
    const wed = screen.getByTestId('day-2026-04-22')
    const titles = within(wed).getAllByRole('button').map(b => b.textContent)
    expect(titles[0]).toContain('Morning Market')
    expect(titles[1]).toContain('Late Show')
    expect(within(wed).getByText('· 2')).toBeInTheDocument()
    expect(screen.getByText('2 EVENTS')).toBeInTheDocument()
    // the other six days stay empty
    expect(screen.getAllByText('— nothing listed')).toHaveLength(6)
  })

  it('shows an all-day event without a clock time', () => {
    hook.mockReturnValue({ events: [ev('c', new Date(2026, 3, 24, 0, 0).toISOString(), 'Street Fest', { is_all_day: true })], loading: false, error: null })
    renderSection()
    expect(screen.getByText('all day')).toBeInTheDocument()
  })

  it('calls onSelectEvent when a row is clicked', () => {
    const onSelect = vi.fn()
    hook.mockReturnValue({ events: [ev('x', new Date(2026, 3, 21, 19, 0).toISOString(), 'Talk')], loading: false, error: null })
    renderSection({ onSelectEvent: onSelect })
    fireEvent.click(screen.getByText('Talk'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'x' }))
  })

  it('offers to clear filters when filters hide every event', () => {
    const clear = vi.fn()
    hook.mockReturnValue({ events: [], loading: false, error: null })
    renderSection({ hasFilters: true, onClearFilters: clear })
    fireEvent.click(screen.getByText('Clear filters'))
    expect(clear).toHaveBeenCalled()
  })

  it('shows loading placeholders and errors', () => {
    hook.mockReturnValue({ events: [], loading: true, error: null })
    const { unmount } = renderSection()
    expect(screen.getAllByText(/Loading…/).length).toBeGreaterThan(0)
    unmount()
    hook.mockReturnValue({ events: [], loading: false, error: 'boom' })
    renderSection()
    expect(screen.getByText(/Could not load this week: boom/)).toBeInTheDocument()
  })
})
