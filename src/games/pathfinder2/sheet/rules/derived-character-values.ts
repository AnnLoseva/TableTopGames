import { PATHFINDER2_SKILLS } from '../data'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillId,
} from '../types'
import { getAncestryById, getClassById } from '../data/selectors'
import { buildCharacter } from './creation/build-character'

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

export function getSkillAttribute(skillId: Pathfinder2SkillId): Pathfinder2AttributeKey {
  return PATHFINDER2_SKILLS.find(skill => skill.id === skillId)?.attribute ?? 'wisdom'
}

export function getSkillModifier(
  build: Pathfinder2CharacterBuild,
  skillId: Pathfinder2SkillId,
) {
  return build.skills.skills[skillId].modifier
}

export function calculateDerivedCharacterValues(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
  existingBuild?: Pathfinder2CharacterBuild,
): Pathfinder2DerivedValues {
  const characterBuild = existingBuild ?? buildCharacter(draft, catalog)
  const attributes = characterBuild.attributes.modifiers
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const characterClass = getClassById(catalog, draft.classId)
  const proficiency = draft.level + 2
  const selectedKeyAbility = draft.attributeChoices.classKeyBoost
  const keyAbility = selectedKeyAbility
    && characterClass?.keyAbilities.includes(selectedKeyAbility)
    ? selectedKeyAbility
    : ''
  const keyModifier = keyAbility ? attributes[keyAbility] : 0
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
          + draft.level * (characterClass.hp + attributes.constitution),
      )
      : null,
    armorClass: 10 + proficiency + attributes.dexterity,
    perception: perceptionProficiency + attributes.wisdom,
    classDc: characterClass ? 10 + classProficiency + keyModifier : null,
    fortitude: fortitudeProficiency + attributes.constitution,
    reflex: reflexProficiency + attributes.dexterity,
    will: willProficiency + attributes.wisdom,
    speed: ancestry?.speed ?? null,
    proficiency,
    keyAbility,
  }
}
