import { describe, it, expect } from 'vitest'
import { sourceLabel, SOURCE_LABELS } from './sourceLabels'

describe('sourceLabel', () => {
  it('returns the friendly name for known keys', () => {
    expect(sourceLabel('clockout')).toBe('Clockout DC')
    expect(sourceLabel('washingtonian')).toBe('Washingtonian')
    expect(sourceLabel('730dc')).toBe('730DC')
    expect(sourceLabel('rhizome')).toBe('Rhizome DC')
    expect(sourceLabel('sixthandi')).toBe('Sixth & I')
    expect(sourceLabel('unionmarket')).toBe('Union Market')
    expect(sourceLabel('imp')).toBe('I.M.P.')
  })

  it('falls back to the key for unknown sources', () => {
    expect(sourceLabel('nonexistent')).toBe('nonexistent')
    expect(sourceLabel('e2e')).toBe('e2e')
  })

  it('SOURCE_LABELS map covers the 7 production sources', () => {
    expect(Object.keys(SOURCE_LABELS).sort()).toEqual(['730dc', 'clockout', 'imp', 'rhizome', 'sixthandi', 'unionmarket', 'washingtonian'])
  })
})
