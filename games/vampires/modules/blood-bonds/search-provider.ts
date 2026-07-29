import type { MasterSearchHit, MasterSearchProvider } from '@/games/vampires/modules/master-console/search/types'
import { haystackMatch } from '@/games/vampires/modules/master-console/search/match'
import { loadActorsByRoom } from '@/games/vampires/modules/actors/api'
import { fetchBloodBonds } from './api'

/** Master-only — bonds are private by default; no player-facing index. */
export const bloodBondsSearchProvider: MasterSearchProvider = {
  id: 'blood-bonds',
  label: 'Узы крови',
  entityTypes: ['blood_bond'],
  allowedRoles: ['master'],
  async search({ room, role, query, limit = 8 }) {
    if (role !== 'master') return []
    const [{ bonds }, actors] = await Promise.all([
      fetchBloodBonds(room),
      loadActorsByRoom(room).catch(() => []),
    ])
    const nameById = new Map(actors.map(actor => [actor.id, actor.name]))
    const hits: MasterSearchHit[] = []
    for (const bond of bonds) {
      const thrall = nameById.get(bond.thrallActorId) || bond.thrallActorId.slice(0, 8)
      const regnant = nameById.get(bond.regnantActorId) || bond.regnantActorId.slice(0, 8)
      const title = `${thrall} → ${regnant}`
      const m = haystackMatch([title, thrall, regnant, bond.status, `lvl ${bond.level}`], query)
      if (!m) continue
      hits.push({
        id: `bond:${bond.id}`,
        title,
        subtitle: `ур. ${bond.level} · ${bond.status}`,
        entityType: 'blood_bond',
        moduleId: 'blood-bonds',
        entityId: bond.id,
        icon: '∞',
        isPrivate: true,
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'bond',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}
