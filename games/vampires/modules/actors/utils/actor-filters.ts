import type { ActorListFilter, NormalizedActor } from '../types'

export const EMPTY_ACTOR_FILTER: ActorListFilter = {
  query: '',
  sceneScope: 'all',
  faction: null,
  clan: null,
  kind: null,
  status: null,
  tag: null,
}

export function filterActors(
  actors: readonly NormalizedActor[],
  filter: ActorListFilter,
  activeSceneId: string | null,
): NormalizedActor[] {
  const query = filter.query.trim().toLowerCase()

  return actors.filter(actor => {
    if (filter.sceneScope === 'in_scene') {
      if (!activeSceneId || actor.currentSceneId !== activeSceneId) return false
    }
    if (filter.sceneScope === 'not_in_scene') {
      if (activeSceneId && actor.currentSceneId === activeSceneId) return false
    }
    if (filter.faction && actor.faction !== filter.faction) return false
    if (filter.clan && actor.clan !== filter.clan) return false
    if (filter.kind && actor.kind !== filter.kind) return false
    if (filter.status && actor.status !== filter.status) return false
    if (filter.tag && !actor.tags.includes(filter.tag)) return false

    if (!query) return true

    const haystack = [
      actor.displayName,
      actor.actorRole,
      actor.faction,
      actor.clan,
      actor.status,
      actor.kind,
      ...actor.tags,
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  })
}

export function collectFilterOptions(actors: readonly NormalizedActor[]) {
  const factions = new Set<string>()
  const clans = new Set<string>()
  const tags = new Set<string>()
  for (const actor of actors) {
    if (actor.faction) factions.add(actor.faction)
    if (actor.clan) clans.add(actor.clan)
    for (const tag of actor.tags) tags.add(tag)
  }
  return {
    factions: [...factions].sort((a, b) => a.localeCompare(b, 'ru')),
    clans: [...clans].sort((a, b) => a.localeCompare(b, 'ru')),
    tags: [...tags].sort((a, b) => a.localeCompare(b, 'ru')),
  }
}
