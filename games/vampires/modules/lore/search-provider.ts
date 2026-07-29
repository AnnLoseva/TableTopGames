import type { MasterSearchHit, MasterSearchProvider } from '@/games/vampires/modules/master-console/search/types'
import { haystackMatch } from '@/games/vampires/modules/master-console/search/match'
import { fetchMasterLoreEntries, fetchRandomTables, fetchSharedLoreEntries } from './api'

export const loreSearchProvider: MasterSearchProvider = {
  id: 'lore',
  label: 'Лор',
  entityTypes: ['lore'],
  allowedRoles: ['master', 'observer'],
  async search({ room, role, query, limit = 8 }) {
    // Role-scoped fetch: observers never load master-only drafts.
    const entries = role === 'master'
      ? (await fetchMasterLoreEntries(room)).entries
      : await fetchSharedLoreEntries(room)

    const hits: MasterSearchHit[] = []
    for (const entry of entries) {
      const m = haystackMatch(
        [entry.title, entry.shortSummary, entry.categorySlug, entry.tags.join(' ')],
        query,
      )
      if (!m) continue
      const isPrivate = entry.visibility === 'master' || entry.status === 'draft'
      if (role !== 'master' && isPrivate) continue
      hits.push({
        id: `lore:${entry.id}`,
        title: entry.title,
        subtitle: entry.shortSummary || entry.categorySlug,
        entityType: 'lore',
        moduleId: 'lore',
        entityId: entry.id,
        icon: '✎',
        isPrivate,
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'entry',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}

export const randomTablesSearchProvider: MasterSearchProvider = {
  id: 'random-tables',
  label: 'Случайные таблицы',
  entityTypes: ['random_table'],
  allowedRoles: ['master', 'observer'],
  async search({ room, role, query, limit = 8 }) {
    const { tables } = await fetchRandomTables(room)
    const hits: MasterSearchHit[] = []
    for (const table of tables) {
      if (role !== 'master' && table.visibility === 'master') continue
      const m = haystackMatch([table.title, table.description, table.tags.join(' ')], query)
      if (!m) continue
      hits.push({
        id: `table:${table.id}`,
        title: table.title,
        subtitle: table.description || `${table.rows.length} строк`,
        entityType: 'random_table',
        moduleId: 'lore',
        entityId: table.id,
        icon: '🎲',
        isPrivate: table.visibility === 'master',
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'table',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}
