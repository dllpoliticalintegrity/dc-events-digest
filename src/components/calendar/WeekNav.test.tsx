import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekNav } from './WeekNav'

describe('WeekNav', () => {
  it('shows the week range and calls callbacks', () => {
    const onPrev = vi.fn(), onNext = vi.fn(), onToday = vi.fn()
    render(<WeekNav weekStart={new Date('2026-04-20T00:00:00Z')} onPrev={onPrev} onNext={onNext} onToday={onToday} />)
    expect(screen.getByText(/Apr 20 — Apr 26, 2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('previous week')); expect(onPrev).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('next week')); expect(onNext).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Today')); expect(onToday).toHaveBeenCalled()
  })
})
