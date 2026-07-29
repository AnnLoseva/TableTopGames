import type {
  Pathfinder2CharacterState,
  Pathfinder2FeatRule,
  Pathfinder2FeatSlot,
  Pathfinder2ProficiencyRank,
  Pathfinder2Requirement,
} from '../../types'
import { PROFICIENCY_RANKS } from '../skills/proficiency'

function rankAtLeast(
  actual: Pathfinder2ProficiencyRank,
  required: Pathfinder2ProficiencyRank,
) {
  return PROFICIENCY_RANKS.indexOf(actual) >= PROFICIENCY_RANKS.indexOf(required)
}

export function evaluateRequirement(
  requirement: Pathfinder2Requirement,
  state: Pathfinder2CharacterState,
) {
  const draft = state.draft
  if (requirement.type === 'level') {
    return draft.progression.level >= requirement.minimum
  }
  if (requirement.type === 'attribute') {
    return state.legacyBuild.attributes.modifiers[requirement.attribute]
      >= requirement.minimum
  }
  if (requirement.type === 'skill-rank') {
    return rankAtLeast(
      state.legacyBuild.skills.skills[requirement.skillId].rank,
      requirement.minimum,
    )
  }
  if (requirement.type === 'class') return draft.class.classId === requirement.classId
  if (requirement.type === 'ancestry') {
    return draft.ancestry.ancestryId === requirement.ancestryId
  }
  if (requirement.type === 'heritage') {
    return draft.ancestry.heritageId === requirement.heritageId
      || draft.ancestry.versatileHeritageId === requirement.heritageId
  }
  if (requirement.type === 'feat') return state.grantedFeatIds.includes(requirement.featId)
  if (requirement.type === 'feature') {
    return state.features.some(feature => feature.id === requirement.featureId)
  }
  if (requirement.type === 'proficiency') {
    return state.proficiencies.some(proficiency => (
      proficiency.category === requirement.category
      && rankAtLeast(proficiency.rank, requirement.minimum)
    ))
  }
  // A custom requirement is never silently accepted by the engine.
  return false
}

export function getFeatAvailability(
  feat: Pathfinder2FeatRule,
  slot: Pathfinder2FeatSlot,
  state: Pathfinder2CharacterState,
) {
  const expectedCategory = slot.type === 'skill-feat'
    ? 'skill'
    : slot.type === 'mythic-feat'
      ? 'mythic'
      : slot.type === 'general-feat'
        ? 'general'
        : null
  const reasons: string[] = []
  if (!expectedCategory || feat.category !== expectedCategory) {
    reasons.push('Тип черты не соответствует слоту.')
  }
  if (feat.level > slot.level) reasons.push('Уровень черты выше уровня слота.')
  if (state.grantedFeatIds.includes(feat.id)) reasons.push('Черта уже получена.')
  feat.requirements.forEach(requirement => {
    if (!evaluateRequirement(requirement, state)) {
      reasons.push(requirement.type === 'custom'
        ? `Требует ручной проверки: ${requirement.description}`
        : 'Не выполнено структурированное требование.')
    }
  })
  return { available: reasons.length === 0, reasons }
}
