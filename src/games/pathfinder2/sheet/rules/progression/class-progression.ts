import type {
  Pathfinder2CharacterSource,
  Pathfinder2ClassProgressionLevel,
  Pathfinder2ProficiencyGrant,
  Pathfinder2RulesCatalog,
} from '../../types'
import { getClassById } from '../../data/selectors'

function levelRule(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  level: number,
) {
  const globalRule = catalog.classProgression
    .find(entry => entry.classId === null)?.levels
    .find(entry => entry.level === level)
  const classRule = catalog.classProgression
    .find(entry => entry.classId === classId)?.levels
    .find(entry => entry.level === level)
  if (!globalRule && !classRule) return null

  const featSlots = Array.from(new Map([
    ...(globalRule?.featSlots ?? []),
    ...(classRule?.featSlots ?? []),
  ].map(slot => [slot.id, slot])).values())
  return {
    level,
    automaticFeatureIds: Array.from(new Set([
      ...(globalRule?.automaticFeatureIds ?? []),
      ...(classRule?.automaticFeatureIds ?? []),
    ])),
    proficiencyGrants: [
      ...(globalRule?.proficiencyGrants ?? []),
      ...(classRule?.proficiencyGrants ?? []),
    ],
    featSlots,
    skillIncreaseCount: Math.max(
      globalRule?.skillIncreaseCount ?? 0,
      classRule?.skillIncreaseCount ?? 0,
    ),
    attributeBoostCount: Math.max(
      globalRule?.attributeBoostCount ?? 0,
      classRule?.attributeBoostCount ?? 0,
    ),
  } satisfies Pathfinder2ClassProgressionLevel
}

export function getClassProgressionLevel(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  level: number,
) {
  return levelRule(catalog, classId, level)
}

export function hasClassProgression(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
) {
  return catalog.classProgression.some(entry => entry.classId === classId)
}

export function getClassProgressionGrants(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  characterLevel: number,
): Pathfinder2ProficiencyGrant[] {
  const characterClass = getClassById(catalog, classId)
  if (!characterClass) return []
  const source: Pathfinder2CharacterSource = {
    type: 'class',
    id: characterClass.id,
    label: `Прогрессия класса · ${characterClass.name}`,
  }
  return Array.from({ length: Math.max(0, characterLevel) }, (_, index) => index + 1)
    .flatMap(level => levelRule(catalog, classId, level)?.proficiencyGrants ?? [])
    .map(grant => ({
      ...grant,
      source: {
        ...source,
        level: grant.level,
      },
    }))
}

export function getClassSkillIncreaseLevels(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
) {
  const progressionLevels = Array.from({ length: 20 }, (_, index) => index + 1)
    .filter(level => (levelRule(catalog, classId, level)?.skillIncreaseCount ?? 0) > 0)
  return progressionLevels.length
    ? progressionLevels
    : [...(getClassById(catalog, classId)?.skillRules.skillIncreaseLevels ?? [])]
}

export function getAvailableSkillIncreaseLevels(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  characterLevel: number,
) {
  return getClassSkillIncreaseLevels(catalog, classId)
    .filter(level => level <= characterLevel)
}
