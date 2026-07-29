import type { MasterSearchHit, MasterSearchProvider } from '@/games/vampires/modules/master-console/search/types'
import { haystackMatch } from '@/games/vampires/modules/master-console/search/match'
import { loadActorsByRoom } from './api'

/**
 * Public actor rows only (no private fields join).
 * Master and observer both search chronicle_actors; secrets never enter the index.
 */
export const actorsSearchProvider: MasterSearchProvider = {
  id: 'actors',
  label: 'Акторы',
  entityTypes: ['actor'],
  allowedRoles: ['master', 'observer'],
  async search({ room, query, limit = 8 }) {
    const actors = await loadActorsByRoom(room)
    const hits: MasterSearchHit[] = []
    for (const actor of actors) {
      const m = haystackMatch(
        [actor.name, actor.faction, actor.actorRole, actor.kind, actor.tags.join(' ')],
        query,
      )
      if (!m) continue
      hits.push({
        id: `actor:${actor.id}`,
        title: actor.name,
        subtitle: [actor.kind, actor.faction, actor.status].filter(Boolean).join(' · '),
        entityType: 'actor',
        moduleId: 'actors',
        entityId: actor.id,
        icon: '♟',
        isPrivate: false,
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'actor',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}
