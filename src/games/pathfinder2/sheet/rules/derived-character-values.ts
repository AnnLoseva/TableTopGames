import { PATHFINDER2_SKILLS } from '../data'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
} from '../types'
import { getAncestryById, getClassById } from '../data/selectors'

export function signedModifier(value: number) {
  return value >= 0 ? `+${value}` : String(value)
}

export function clampLevel(value: number) {
  return Math.min(20, Math.max(1, Math.round(value || 1)))
}

export function getRuleProficiency(value: string, level: number) {
  const normalized = value.toLocaleLowerCase('en')
  if (normalized.includes('legendary')) return level + 8
  if (normalized.includes('master')) return level + 6
  if (normalized.includes('expert')) return level + 4
  if (normalized.includes('trained')) return level + 2
  return 0
}

export function proficiencyLabel(value: string) {
  const normalized = value.toLocaleLowerCase('en')
  if (normalized.includes('legendary')) return 'легенда'
  if (normalized.includes('master')) return 'мастер'
  if (normalized.includes('expert')) return 'эксперт'
  if (normalized.includes('trained')) return 'обучен'
  return 'не обучен'
}

export function getSkillAttribute(skill: string): Pathfinder2AttributeKey {
  if (skill === 'Атлетика') return 'strength'
  if (['Акробатика', 'Воровство', 'Скрытность'].includes(skill)) return 'dexterity'
  if (['Аркана', 'Общество', 'Ремесло'].includes(skill)) return 'intelligence'
  if (
    ['Дипломатия', 'Запугивание', 'Обман', 'Исполнительство'].includes(skill)
  ) {
    return 'charisma'
  }
  return 'wisdom'
}

export function getSkillModifier(
  draft: Pathfinder2CharacterDraft,
  skill: string,
) {
  const ability = getSkillAttribute(skill)
  const trained = draft.trainedSkills.includes(skill)
  return draft.attributes[ability] + (trained ? draft.level + 2 : 0)
}

export function getBackgroundSkills(value: string): string[] {
  const primarySkill = value.split(' (')[0].split(' или ')[0].trim()
  return PATHFINDER2_SKILLS
    .map(skill => String(skill))
    .filter(skill => skill === primarySkill)
}

export function calculateDerivedCharacterValues(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2DerivedValues {
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const characterClass = getClassById(catalog, draft.classId)
  const proficiency = draft.level + 2
  const keyAbility = draft.keyAbility || characterClass?.keyAbilities[0] || ''
  const keyModifier = keyAbility ? draft.attributes[keyAbility] : 0
  const perceptionProficiency = characterClass
    ? getRuleProficiency(characterClass.perception, draft.level)
    : proficiency
  const classProficiency = characterClass
    ? getRuleProficiency(characterClass.classDc, draft.level)
    : proficiency
  const fortitudeProficiency = characterClass
    ? getRuleProficiency(characterClass.fortitude, draft.level)
    : proficiency
  const reflexProficiency = characterClass
    ? getRuleProficiency(characterClass.reflex, draft.level)
    : proficiency
  const willProficiency = characterClass
    ? getRuleProficiency(characterClass.will, draft.level)
    : proficiency

  return {
    maxHp: ancestry && characterClass
      ? Math.max(
        1,
        ancestry.hp
          + draft.level * (characterClass.hp + draft.attributes.constitution),
      )
      : null,
    armorClass: 10 + proficiency + draft.attributes.dexterity,
    perception: perceptionProficiency + draft.attributes.wisdom,
    classDc: characterClass ? 10 + classProficiency + keyModifier : null,
    fortitude: fortitudeProficiency + draft.attributes.constitution,
    reflex: reflexProficiency + draft.attributes.dexterity,
    will: willProficiency + draft.attributes.wisdom,
    speed: ancestry?.speed ?? null,
    proficiency,
    keyAbility,
  }
}
