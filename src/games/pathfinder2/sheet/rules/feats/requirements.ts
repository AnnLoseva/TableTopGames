import type {
  Pathfinder2CharacterState,
  Pathfinder2FeatRule,
  Pathfinder2FeatSlot,
  Pathfinder2ProficiencyRank,
  Pathfinder2Requirement,
  Pathfinder2RulesCatalog,
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
  options: { ignoreAlreadyGranted?: boolean } = {},
) {
  const expectedCategory = slot.type === 'skill-feat'
    ? 'skill'
    : slot.type === 'mythic-feat'
      ? 'mythic'
      : slot.type === 'general-feat'
        ? 'general'
        : slot.type === 'ancestry-feat'
          ? 'ancestry'
          : slot.type === 'class-feat'
            ? 'class'
        : null
  const reasons: string[] = []
  if (!expectedCategory || feat.category !== expectedCategory) {
    reasons.push('Тип черты не соответствует слоту.')
  }
  if (feat.level > slot.level) reasons.push('Уровень черты выше уровня слота.')
  if (!options.ignoreAlreadyGranted && state.grantedFeatIds.includes(feat.id)) {
    reasons.push('Черта уже получена.')
  }
  if (
    feat.category === 'ancestry'
    && feat.ancestryIds?.length
    && !feat.ancestryIds.includes(state.draft.ancestry.ancestryId)
  ) {
    reasons.push('Черта недоступна выбранному народу.')
  }
  if (
    feat.category === 'class'
    && feat.classIds?.length
    && !feat.classIds.includes(state.draft.class.classId)
  ) {
    reasons.push('Черта недоступна выбранному классу.')
  }
  const manualReview: string[] = []
  feat.requirements.forEach(requirement => {
    if (requirement.type === 'custom') {
      manualReview.push(`Ручная проверка: ${requirement.description}`)
      return
    }
    if (!evaluateRequirement(requirement, state)) {
      reasons.push('Не выполнено структурированное требование.')
    }
  })
  return {
    available: reasons.length === 0,
    reasons: [...reasons, ...manualReview],
    needsManualReview: manualReview.length > 0,
  }
}

export function getFeatsForSlot(
  slot: Pathfinder2FeatSlot,
  catalog: Pathfinder2RulesCatalog,
) {
  if (slot.type === 'ancestry-feat') return catalog.ancestryFeats
  if (slot.type === 'class-feat') return catalog.classFeats
  if (slot.type === 'skill-feat') return catalog.skillFeats
  if (slot.type === 'general-feat') return catalog.generalFeats
  if (slot.type === 'mythic-feat') return catalog.mythicFeats
  return []
}
