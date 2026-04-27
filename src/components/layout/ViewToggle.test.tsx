// src/components/layout/ViewToggle.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from './ViewToggle'

describe('ViewToggle', () => {
  it('renders both options and marks active', () => {
    render(<ViewToggle view="week" onChange={() => {}} />)
    expect(screen.getByText('WEEK').closest('button')).toHaveClass('text-stamp')
    expect(screen.getByText('DAY').closest('button')).not.toHaveClass('text-stamp')
  })

  it('calls onChange when clicked', () => {
    const onChange = vi.fn()
    render(<ViewToggle view="week" onChange={onChange} />)
    fireEvent.click(screen.getByText('DAY'))
    expect(onChange).toHaveBeenCalledWith('day')
  })
})
