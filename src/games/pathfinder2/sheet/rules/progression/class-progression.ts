import type { Pathfinder2RulesCatalog } from '../../types'
import { getClassById } from '../../data/selectors'

export function getClassSkillIncreaseLevels(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
) {
  return [...(getClassById(catalog, classId)?.skillRules.skillIncreaseLevels ?? [])]
}

export function getAvailableSkillIncreaseLevels(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  characterLevel: number,
) {
  return getClassSkillIncreaseLevels(catalog, classId)
    .filter(level => level <= characterLevel)
}
