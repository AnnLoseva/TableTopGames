export function makeDieId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getDotDisplay(value: number) {
  const dots = Math.max(0, Math.min(5, Math.floor(Number(value) || 0)))
  return `${'●'.repeat(dots)}${'○'.repeat(5 - dots)}`
}

export function formatRuleValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatRuleValue).join(' · ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key.replaceAll('_', ' ')}: ${formatRuleValue(nestedValue)}`)
      .join(' · ')
  }
  return String(value)
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}