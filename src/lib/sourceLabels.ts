export const SOURCE_LABELS: Record<string, string> = {
  clockout: 'Clockout DC',
  washingtonian: 'Washingtonian',
  '730dc': '730DC',
  rhizome: 'Rhizome DC',
  sixthandi: 'Sixth & I',
  unionmarket: 'Union Market',
  imp: 'I.M.P.',
}

export function sourceLabel(key: string): string {
  return SOURCE_LABELS[key] ?? key
}
