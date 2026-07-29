import type { ActorSortDir, ActorSortKey, NormalizedActor } from '../types'

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, 'ru', { sensitivity: 'base' })
}

function sortValue(actor: NormalizedActor, key: ActorSortKey): string | number {
  switch (key) {
    case 'name':
      return actor.displayName
    case 'faction':
      return actor.faction
    case 'status':
      return actor.status
    case 'kind':
      return actor.kind
    case 'actorRole':
      return actor.actorRole
    case 'hunger':
      return actor.vitals.hunger
    case 'bloodPotency':
      return actor.vitals.bloodPotency
    case 'willpower':
      return actor.vitals.willpower.current
    default:
      return actor.displayName
  }
}

export function sortActors(
  actors: readonly NormalizedActor[],
  key: ActorSortKey,
  dir: ActorSortDir,
): NormalizedActor[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...actors].sort((left, right) => {
    const a = sortValue(left, key)
    const b = sortValue(right, key)
    if (typeof a === 'number' && typeof b === 'number') {
      if (a === b) return compareStrings(left.displayName, right.displayName) * factor
      return (a - b) * factor
    }
    const cmp = compareStrings(String(a), String(b))
    if (cmp === 0) return compareStrings(left.displayName, right.displayName) * factor
    return cmp * factor
  })
}
