import { getClassById } from '../../data/selectors'
import type {
  Pathfinder2CalculatedProficiency,
  Pathfinder2CharacterDraftV4,
  Pathfinder2ProficiencyGrant,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
} from '../../types'
import { getProficiencyBonus, PROFICIENCY_RANKS } from '../skills/proficiency'

function grantKey(grant: Pathfinder2ProficiencyGrant) {
  return `${grant.category}:${grant.targetId ?? ''}`
}

function higherRank(
  left: Pathfinder2ProficiencyRank,
  right: Pathfinder2ProficiencyRank,
) {
  return PROFICIENCY_RANKS.indexOf(left) >= PROFICIENCY_RANKS.indexOf(right)
    ? left
    : right
}

export function calculateProficiencyGrants(
  grants: Pathfinder2ProficiencyGrant[],
  level: number,
): Pathfinder2CalculatedProficiency[] {
  const applicable = grants.filter(grant => grant.level <= level)
  const grouped = new Map<string, Pathfinder2ProficiencyGrant[]>()

  applicable.forEach(grant => {
    const key = grantKey(grant)
    grouped.set(key, [...(grouped.get(key) ?? []), grant])
  })

  return [...grouped.entries()]
    .map(([, entries]) => {
      const rank = entries.reduce<Pathfinder2ProficiencyRank>(
        (current, entry) => higherRank(current, entry.rank),
        'untrained',
      )
      const first = entries[0]
      return {
        category: first.category,
        ...(first.targetId ? { targetId: first.targetId } : {}),
        rank,
        bonus: getProficiencyBonus(rank, level),
        sources: entries
          .filter(entry => entry.rank === rank)
          .map(entry => entry.source),
      }
    })
    .sort((left, right) => (
      `${left.category}:${left.targetId ?? ''}`
        .localeCompare(`${right.category}:${right.targetId ?? ''}`, 'en')
    ))
}

export function calculateProficiencies(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
) {
  const characterClass = getClassById(catalog, draft.class.classId)
  return calculateProficiencyGrants(
    characterClass?.proficiencyGrants ?? [],
    draft.progression.level,
  )
}
