import { describe, it, expect } from 'vitest'
import { sourceLabel, SOURCE_LABELS } from './sourceLabels'

describe('sourceLabel', () => {
  it('returns the friendly name for known keys', () => {
    expect(sourceLabel('clockout')).toBe('Clockout DC')
    expect(sourceLabel('washingtonian')).toBe('Washingtonian')
    expect(sourceLabel('730dc')).toBe('730DC')
  })

  it('falls back to the key for unknown sources', () => {
    expect(sourceLabel('nonexistent')).toBe('nonexistent')
    expect(sourceLabel('e2e')).toBe('e2e')
  })

  it('SOURCE_LABELS map covers the 3 production sources', () => {
    expect(Object.keys(SOURCE_LABELS).sort()).toEqual(['730dc', 'clockout', 'washingtonian'])
  })
})
