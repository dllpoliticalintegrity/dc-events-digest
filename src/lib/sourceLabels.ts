export const SOURCE_LABELS: Record<string, string> = {
  clockout: 'Clockout DC',
  washingtonian: 'Washingtonian',
  '730dc': '730DC',
}

export function sourceLabel(key: string): string {
  return SOURCE_LABELS[key] ?? key
}
