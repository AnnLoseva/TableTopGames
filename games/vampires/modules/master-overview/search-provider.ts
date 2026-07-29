import type { MasterSearchHit, MasterSearchProvider } from '@/games/vampires/modules/master-console/search/types'
import { haystackMatch } from '@/games/vampires/modules/master-console/search/match'
import { fetchSessionNotes } from './api'

/** Session notes — master-only private content. */
export const notesSearchProvider: MasterSearchProvider = {
  id: 'notes',
  label: 'Заметки',
  entityTypes: ['note'],
  allowedRoles: ['master'],
  async search({ room, role, query, limit = 8 }) {
    if (role !== 'master') return []
    const { notes } = await fetchSessionNotes(room)
    const hits: MasterSearchHit[] = []
    for (const note of notes) {
      const plain = note.bodyHtml.replace(/<[^>]+>/g, ' ').slice(0, 120)
      const m = haystackMatch([note.title, plain, note.entityType], query)
      if (!m) continue
      hits.push({
        id: `note:${note.id}`,
        title: note.title || 'Заметка сессии',
        subtitle: plain.trim() || note.visibility,
        entityType: 'note',
        moduleId: 'overview',
        entityId: note.id,
        icon: '📝',
        isPrivate: note.visibility === 'master',
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'focus',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}
