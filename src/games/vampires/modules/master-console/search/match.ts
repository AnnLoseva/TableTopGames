import type { MasterSearchMatchRange } from './types'

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Case-insensitive substring match with ranges for highlighting. */
export function matchText(
  text: string,
  query: string,
): { score: number; ranges: MasterSearchMatchRange[] } | null {
  const q = normalizeQuery(query)
  if (!q) return { score: 0, ranges: [] }
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx >= 0) {
    const prefixBonus = idx === 0 ? 40 : idx <= 2 ? 20 : 0
    return {
      score: 100 - Math.min(idx, 50) + prefixBonus + Math.max(0, 20 - Math.abs(text.length - q.length)),
      ranges: [{ start: idx, end: idx + q.length }],
    }
  }
  // Token AND match
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length < 2) return null
  const ranges: MasterSearchMatchRange[] = []
  let score = 30
  for (const token of tokens) {
    const tIdx = lower.indexOf(token)
    if (tIdx < 0) return null
    ranges.push({ start: tIdx, end: tIdx + token.length })
    score += 15
  }
  return { score, ranges }
}

export function haystackMatch(
  fields: readonly (string | null | undefined)[],
  query: string,
): { score: number; ranges: MasterSearchMatchRange[]; fieldIndex: number } | null {
  let best: { score: number; ranges: MasterSearchMatchRange[]; fieldIndex: number } | null = null
  fields.forEach((field, index) => {
    if (!field) return
    const m = matchText(field, query)
    if (!m) return
    const adjusted = { score: m.score - index * 5, ranges: m.ranges, fieldIndex: index }
    if (!best || adjusted.score > best.score) best = adjusted
  })
  return best
}

export function highlightTitle(
  title: string,
  ranges: readonly MasterSearchMatchRange[] | undefined,
): { text: string; highlight: boolean }[] {
  if (!ranges?.length) return [{ text: title, highlight: false }]
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const parts: { text: string; highlight: boolean }[] = []
  let cursor = 0
  for (const range of sorted) {
    const start = Math.max(0, Math.min(title.length, range.start))
    const end = Math.max(start, Math.min(title.length, range.end))
    if (start > cursor) parts.push({ text: title.slice(cursor, start), highlight: false })
    if (end > start) parts.push({ text: title.slice(start, end), highlight: true })
    cursor = end
  }
  if (cursor < title.length) parts.push({ text: title.slice(cursor), highlight: false })
  return parts
}

export function entityTypeLabel(type: string): string {
  switch (type) {
    case 'actor': return 'Актор'
    case 'scene': return 'Сцена'
    case 'layer': return 'Слой'
    case 'lore': return 'Лор'
    case 'random_table': return 'Таблица'
    case 'note': return 'Заметка'
    case 'session_log': return 'Журнал'
    case 'blood_bond': return 'Узы'
    case 'roll': return 'Бросок'
    case 'action_log': return 'Action log'
    case 'layout': return 'Раскладка'
    case 'module': return 'Модуль'
    case 'macro': return 'Макрос'
    case 'command': return 'Команда'
    default: return type
  }
}
