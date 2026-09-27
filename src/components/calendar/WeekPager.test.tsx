import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekPager } from './WeekPager'

const monday = new Date('2026-04-20T00:00:00Z')

describe('WeekPager', () => {
  it('shows the week range and fires prev/next', () => {
    const onPrev = vi.fn(); const onNext = vi.fn()
    render(<WeekPager weekStart={monday} isCurrentWeek onPrev={onPrev} onNext={onNext} onToday={() => {}} onPickDate={() => {}} />)
    expect(screen.getByText(/APR 20 — APR 26, 2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('previous week'))
    fireEvent.click(screen.getByLabelText('next week'))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('offers Today only when away from the current week', () => {
    const onToday = vi.fn()
    const { rerender } = render(<WeekPager weekStart={monday} isCurrentWeek onPrev={() => {}} onNext={() => {}} onToday={onToday} onPickDate={() => {}} />)
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    rerender(<WeekPager weekStart={monday} isCurrentWeek={false} onPrev={() => {}} onNext={() => {}} onToday={onToday} onPickDate={() => {}} />)
    fireEvent.click(screen.getByText('Today'))
    expect(onToday).toHaveBeenCalled()
  })

  it('compact mode hides the range label but keeps the controls', () => {
    render(<WeekPager weekStart={monday} isCurrentWeek onPrev={() => {}} onNext={() => {}} onToday={() => {}} onPickDate={() => {}} compact />)
    expect(screen.queryByText(/APR 20/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('previous week')).toBeInTheDocument()
    expect(screen.getByLabelText('next week')).toBeInTheDocument()
  })
})


describe('WeekPager date picker', () => {
  it('opens the month grid from the week label and picks a day', () => {
    const onPick = vi.fn()
    render(<WeekPager weekStart={monday} isCurrentWeek onPrev={() => {}} onNext={() => {}} onToday={() => {}} onPickDate={onPick} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('jump to date'))
    expect(screen.getByRole('dialog', { name: 'jump to date' })).toBeInTheDocument()
    expect(screen.getByText('April 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pick-2026-04-29'))
    expect(onPick).toHaveBeenCalledWith(new Date('2026-04-29T00:00:00Z'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()   // closes after picking
  })

  it('steps between months and closes on Escape', () => {
    render(<WeekPager weekStart={monday} isCurrentWeek onPrev={() => {}} onNext={() => {}} onToday={() => {}} onPickDate={() => {}} />)
    fireEvent.click(screen.getByLabelText('jump to date'))
    fireEvent.click(screen.getByLabelText('next month'))
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('previous month'))
    fireEvent.click(screen.getByLabelText('previous month'))
    expect(screen.getByText('March 2026')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
