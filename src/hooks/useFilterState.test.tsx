import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useFilterState } from './useFilterState'
import React from 'react'

function wrapper(initial: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  )
}

describe('useFilterState', () => {
  it('reads type and tags from URL', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper('/?type=music&tags=free,outdoor'),
    })
    expect(result.current.type).toBe('music')
    expect(result.current.tags).toEqual(['free', 'outdoor'])
  })

  it('defaults to type=all and tags=[]', () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: wrapper('/') })
    expect(result.current.type).toBe('all')
    expect(result.current.tags).toEqual([])
  })

  it('writes type to URL on setType', () => {
    const probe: { search: string | null } = { search: null }
    function Probe() {
      const loc = useLocation()
      probe.search = loc.search
      return null
    }
    const { result } = renderHook(
      () => {
        const fs = useFilterState()
        return fs
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/']}>
            {children}
            <Probe />
          </MemoryRouter>
        ),
      }
    )
    act(() => result.current.setType('food'))
    expect(probe.search).toBe('?type=food')
  })

  it('toggles a tag in/out of the URL', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper('/?tags=free'),
    })
    act(() => result.current.toggleTag('outdoor'))
    expect(result.current.tags.sort()).toEqual(['free', 'outdoor'])
    act(() => result.current.toggleTag('free'))
    expect(result.current.tags).toEqual(['outdoor'])
  })
})
