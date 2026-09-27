import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeekFeed, INITIAL_WEEKS } from './WeekFeed'

vi.mock('@/hooks/useEventsForWeek', () => ({
  useEventsForWeek: () => ({ events: [], loading: false, error: null }),
}))

const monday = new Date('2026-04-20T00:00:00Z')

function renderFeed() {
  return render(
    <MemoryRouter>
      <WeekFeed anchorWeek={monday} type="all" tags={[]} hasFilters={false} onClearFilters={() => {}} onSelectEvent={() => {}} />
    </MemoryRouter>,
  )
}

const weekIds = () =>
  Array.from(document.querySelectorAll('[data-week]')).map(el => el.getAttribute('data-week'))

beforeEach(() => { window.scrollBy = vi.fn() as unknown as typeof window.scrollBy })

describe('WeekFeed', () => {
  it('starts on the anchor week and preloads the following weeks in order', () => {
    renderFeed()
    expect(weekIds()).toEqual(['2026-04-20', '2026-04-27'].slice(0, INITIAL_WEEKS))
  })

  it('"next week" appends one more week at the bottom', () => {
    renderFeed()
    fireEvent.click(screen.getByText('▾ next week'))
    expect(weekIds()).toEqual(['2026-04-20', '2026-04-27', '2026-05-04'])
  })

  it('"earlier week" prepends one week at the top without dropping others', () => {
    renderFeed()
    fireEvent.click(screen.getByText('▴ earlier week'))
    expect(weekIds()).toEqual(['2026-04-13', '2026-04-20', '2026-04-27'])
  })

  it('renders a scroll sentinel after the last week for infinite loading', () => {
    renderFeed()
    const sentinel = screen.getByTestId('feed-sentinel')
    const last = document.querySelector('[data-week="2026-04-27"]')!
    expect(sentinel.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })
})
