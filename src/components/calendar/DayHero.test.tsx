import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayHero } from './DayHero'

describe('DayHero', () => {
  it('renders day name and big numeral', () => {
    render(<DayHero day={new Date('2026-04-26T12:00:00Z')} />)
    expect(screen.getByText('SUNDAY')).toBeInTheDocument()  // April 26 2026 IS Sunday
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText(/APR.*2026/i)).toBeInTheDocument()
  })
})
