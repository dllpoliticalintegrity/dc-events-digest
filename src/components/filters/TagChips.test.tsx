import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagChips } from './TagChips'

describe('TagChips', () => {
  it('renders 8 chips', () => {
    render(<TagChips selected={[]} onToggle={() => {}} />)
    ;['free','ticketed','outdoor','21+','family','accessible','weekend','happy-hour'].forEach(t => {
      expect(screen.getByText(t)).toBeInTheDocument()
    })
  })

  it('marks selected chips and calls onToggle', () => {
    const onToggle = vi.fn()
    render(<TagChips selected={['free']} onToggle={onToggle} />)
    expect(screen.getByText('free').closest('button')).toHaveClass('border-stamp')
    fireEvent.click(screen.getByText('outdoor'))
    expect(onToggle).toHaveBeenCalledWith('outdoor')
  })
})
