import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekStrip } from './WeekStrip'

describe('WeekStrip', () => {
  const monday = new Date('2026-04-20T00:00:00Z')
  it('renders 7 day cells with day-of-month numbers', () => {
    render(<WeekStrip weekStart={monday} selected={monday} onSelect={() => {}} densities={{}} />)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument()
  })

  it('marks the selected day', () => {
    const sat = new Date('2026-04-25T00:00:00Z')
    render(<WeekStrip weekStart={monday} selected={sat} onSelect={() => {}} densities={{}} />)
    expect(screen.getByTestId('day-cell-2026-04-25')).toHaveClass('border-stamp')
  })

  it('calls onSelect with the clicked day', () => {
    const onSelect = vi.fn()
    render(<WeekStrip weekStart={monday} selected={monday} onSelect={onSelect} densities={{}} />)
    fireEvent.click(screen.getByTestId('day-cell-2026-04-25'))
    expect(onSelect).toHaveBeenCalledWith(expect.any(Date))
    expect(onSelect.mock.calls[0][0].toISOString().slice(0, 10)).toBe('2026-04-25')
  })
})
