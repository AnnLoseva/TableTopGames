import type { MasterSearchHit, MasterSearchProvider } from './types'
import { haystackMatch } from './match'
import { fetchMasterActionLog, fetchMasterLayouts } from '../api'
import { loadMasterRollHistory } from '@/games/vampires/modules/master-rolls/services/master-roll-service'

/** Action log — master visibility only. */
export const actionLogSearchProvider: MasterSearchProvider = {
  id: 'action-log',
  label: 'Action log',
  entityTypes: ['action_log'],
  allowedRoles: ['master'],
  async search({ room, role, query, limit = 8 }) {
    if (role !== 'master') return []
    const entries = await fetchMasterActionLog(room, 80)
    const hits: MasterSearchHit[] = []
    for (const entry of entries) {
      if (entry.visibility !== 'master' && role !== 'master') continue
      const m = haystackMatch([entry.summary, entry.actionType, entry.actorId], query)
      if (!m) continue
      hits.push({
        id: `action:${entry.id}`,
        title: entry.summary || entry.actionType,
        subtitle: entry.actionType,
        entityType: 'action_log',
        moduleId: 'overview',
        entityId: entry.id,
        icon: '⌁',
        isPrivate: entry.visibility === 'master',
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'focus',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}

/** Layouts — master-owned. */
export const layoutsSearchProvider: MasterSearchProvider = {
  id: 'layouts',
  label: 'Раскладки',
  entityTypes: ['layout'],
  allowedRoles: ['master'],
  async search({ room, role, query, limit = 8 }) {
    if (role !== 'master') return []
    try {
      const layouts = await fetchMasterLayouts(room)
      const hits: MasterSearchHit[] = []
      for (const layout of layouts) {
        const m = haystackMatch([layout.name, layout.id], query)
        if (!m) continue
        hits.push({
          id: `layout:${layout.id}`,
          title: layout.name,
          subtitle: layout.isDefault ? 'default' : `v${layout.layoutVersion}`,
          entityType: 'layout',
          moduleId: 'overview',
          entityId: layout.id,
          icon: '▦',
          isPrivate: true,
          matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
          score: m.score,
          deepLinkKey: 'layout',
        })
      }
      return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
    } catch {
      return []
    }
  },
}

/**
 * Rolls search.
 * Master sees public + hidden (hidden badge).
 * Observer/player would only see public — but provider is master-scoped for hidden.
 */
export const rollsSearchProvider: MasterSearchProvider = {
  id: 'rolls',
  label: 'Броски',
  entityTypes: ['roll'],
  allowedRoles: ['master'],
  async search({ room, role, query, limit = 8 }) {
    if (role !== 'master') return []
    const { publicRolls, hiddenRolls } = await loadMasterRollHistory(room)
    const hits: MasterSearchHit[] = []

    const pushRoll = (
      roll: { id: string; characterName: string; poolName: string; successes?: number },
      hidden: boolean,
    ) => {
      const title = roll.characterName || roll.poolName || `Бросок ${roll.id.slice(0, 8)}`
      const subtitle = [
        roll.poolName,
        typeof roll.successes === 'number' ? `${roll.successes} succ` : '',
        hidden ? 'hidden' : 'public',
      ].filter(Boolean).join(' · ')
      const m = haystackMatch([title, subtitle, roll.id], query)
      if (!m) return
      hits.push({
        id: `roll:${roll.id}`,
        title,
        subtitle,
        entityType: 'roll',
        moduleId: 'overview',
        entityId: roll.id,
        icon: '⚄',
        isPrivate: hidden,
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
      })
    }

    publicRolls.forEach(roll => pushRoll(roll, false))
    hiddenRolls.forEach(roll => pushRoll(roll, true))

    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}
