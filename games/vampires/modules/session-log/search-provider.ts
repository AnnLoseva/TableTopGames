import type { MasterSearchHit, MasterSearchProvider } from '@/games/vampires/modules/master-console/search/types'
import { haystackMatch } from '@/games/vampires/modules/master-console/search/match'
import { fetchMasterSessionLog, fetchPublishedSessionLog } from './api'

export const sessionLogSearchProvider: MasterSearchProvider = {
  id: 'session-log',
  label: 'Журнал сессии',
  entityTypes: ['session_log'],
  allowedRoles: ['master', 'observer'],
  async search({ room, role, query, limit = 8 }) {
    // Master: draft table. Non-master: published projection only — never draft body.
    if (role === 'master') {
      const { entries } = await fetchMasterSessionLog(room)
      const hits: MasterSearchHit[] = []
      for (const entry of entries) {
        const m = haystackMatch([entry.title, entry.tags.join(' '), entry.status], query)
        if (!m) continue
        hits.push({
          id: `session-log:${entry.id}`,
          title: entry.title || 'Без названия',
          subtitle: `${entry.status} · ${entry.visibility}`,
          entityType: 'session_log',
          moduleId: 'session-log',
          entityId: entry.id,
          icon: '☰',
          isPrivate: entry.visibility === 'private' || entry.status === 'draft',
          matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
          score: m.score,
          deepLinkKey: 'entry',
        })
      }
      return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
    }

    const published = await fetchPublishedSessionLog(room).catch(() => [])
    const hits: MasterSearchHit[] = []
    for (const entry of published) {
      const m = haystackMatch([entry.title, entry.tags.join(' ')], query)
      if (!m) continue
      hits.push({
        id: `session-log-pub:${entry.entryId}`,
        title: entry.title || 'Без названия',
        subtitle: 'published',
        entityType: 'session_log',
        moduleId: 'session-log',
        entityId: entry.entryId,
        icon: '☰',
        isPrivate: false,
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'entry',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}
