import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TypeTabs } from './TypeTabs'

describe('TypeTabs', () => {
  it('renders all 7 tabs (All + 6 types)', () => {
    render(<TypeTabs value="all" onChange={() => {}} />)
    ;['All','Music','Food','Arts','Outdoors','Civic','Community'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('calls onChange with the canonical key', () => {
    const onChange = vi.fn()
    render(<TypeTabs value="all" onChange={onChange} />)
    fireEvent.click(screen.getByText('Music'))
    expect(onChange).toHaveBeenCalledWith('music')
  })

  it('marks the active tab', () => {
    render(<TypeTabs value="food" onChange={() => {}} />)
    expect(screen.getByText('Food').closest('button')).toHaveClass('text-stamp')
  })
})
