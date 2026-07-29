import type { LoreEntry, LoreSearchHit, RandomTable } from '../types'
import { searchSystemReference } from './system-reference-provider'

function matchesTags(tags: readonly string[], required: readonly string[]): boolean {
  if (!required.length) return true
  const set = new Set(tags.map(tag => tag.toLowerCase()))
  return required.every(tag => set.has(tag.toLowerCase()))
}

function textMatch(haystack: string, query: string): boolean {
  if (!query) return true
  return haystack.toLowerCase().includes(query.toLowerCase())
}

/**
 * Client-side search over loaded master lore.
 * Never includes privateNote content for non-master consumers — callers must pass
 * already-role-filtered entries.
 */
export function searchLoreCompendium(input: {
  query: string
  tags: readonly string[]
  categorySlug: string | null
  entries: readonly LoreEntry[]
  tables: readonly RandomTable[]
  includeSystem?: boolean
  /** When false, drop master-only visibility rows (player-safe). */
  includeMasterOnly?: boolean
}): LoreSearchHit[] {
  const query = input.query.trim()
  const includeMasterOnly = input.includeMasterOnly !== false
  const hits: LoreSearchHit[] = []

  for (const entry of input.entries) {
    if (!includeMasterOnly && (entry.visibility !== 'shared' || entry.status !== 'published')) continue
    if (input.categorySlug && entry.categorySlug !== input.categorySlug) continue
    if (!matchesTags(entry.tags, input.tags)) continue
    // privateNote intentionally excluded from search haystack for shared safety path
    const haystack = [
      entry.title,
      entry.shortSummary,
      entry.bodyHtml,
      ...entry.tags,
    ].join(' ')
    if (!textMatch(haystack, query)) continue
    hits.push({ kind: 'entry', entry })
  }

  if (!input.categorySlug || input.categorySlug === 'random_tables') {
    for (const table of input.tables) {
      if (!includeMasterOnly && table.visibility !== 'shared') continue
      if (!matchesTags(table.tags, input.tags)) continue
      const haystack = [table.title, table.description, ...table.tags, ...table.rows.map(row => row.text)].join(' ')
      if (!textMatch(haystack, query)) continue
      hits.push({ kind: 'table', table })
    }
  }

  if (input.includeSystem !== false) {
    for (const hit of searchSystemReference(query, input.categorySlug)) {
      if (!matchesTags(hit.tags, input.tags)) continue
      hits.push({ kind: 'system', hit })
    }
  }

  return hits
}
