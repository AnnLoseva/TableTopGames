import { PATHFINDER2_SKILLS } from '../../data'
import {
  getAncestryById,
  getBackgroundById,
  getClassById,
  getHeritageById,
} from '../../data/selectors'
import type {
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillId,
} from '../../types'
import { getAncestryAttributeRules } from '../attributes/calculate-attributes'
import { calculateSkills } from '../skills/calculate-skills'
import { getSkillRuleBlocks } from '../skills/calculate-skills'
import { calculateAttributeModifiers } from '../attributes/calculate-attributes'
import { buildCharacter } from './build-character'

export type Pathfinder2ReconcileResult = {
  draft: Pathfinder2CharacterDraft
  changes: string[]
}

const VALID_SKILL_IDS = new Set(PATHFINDER2_SKILLS.map(skill => skill.id))

function uniqueSkills(values: Pathfinder2SkillId[]) {
  return Array.from(new Set(values.filter(value => VALID_SKILL_IDS.has(value))))
}

export function reconcileCharacterDecisions(
  previous: Pathfinder2CharacterDraft,
  candidate: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ReconcileResult {
  let draft = candidate
  const changes: string[] = []
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const ancestryRules = getAncestryAttributeRules(draft, catalog)
  const ancestryBoosts = Array.from(new Set(draft.attributeChoices.ancestryFreeBoosts))
    .filter(key => !ancestryRules.fixedBoosts.includes(key))
    .slice(0, ancestryRules.freeBoostCount)
  if (ancestryBoosts.length !== draft.attributeChoices.ancestryFreeBoosts.length) {
    changes.push('Несовместимые повышения народа очищены.')
  }
  if (
    draft.heritageId
    && !getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  ) {
    draft = { ...draft, heritageId: '' }
    changes.push('Обычное наследие очищено: оно не относится к новому народу.')
  }

  const background = getBackgroundById(catalog, draft.backgroundId)
  let backgroundLimitedBoost = draft.attributeChoices.backgroundLimitedBoost
  let backgroundFreeBoost = draft.attributeChoices.backgroundFreeBoost
  if (
    backgroundLimitedBoost
    && !background?.abilityBoostOptions.includes(backgroundLimitedBoost)
  ) {
    backgroundLimitedBoost = null
    changes.push('Ограниченное повышение прежней предыстории сброшено.')
  }
  if (backgroundFreeBoost && backgroundFreeBoost === backgroundLimitedBoost) {
    backgroundFreeBoost = null
    changes.push('Свободное повышение предыстории сброшено из-за конфликта.')
  }

  const characterClass = getClassById(catalog, draft.classId)
  let classKeyBoost = draft.attributeChoices.classKeyBoost
  if (classKeyBoost && !characterClass?.keyAbilities.includes(classKeyBoost)) {
    classKeyBoost = null
    changes.push('Ключевая характеристика сброшена: новый класс её не разрешает.')
  }

  const activeChoiceIds = new Set([
    ...(background?.skillRules.grantedSkillChoices ?? []),
    ...(characterClass?.skillRules.grantedSkillChoices ?? []),
  ].map(rule => rule.id))
  const grantedChoiceSelections = Object.fromEntries(
    Object.entries(draft.skillChoices.grantedChoiceSelections)
      .filter(([id]) => activeChoiceIds.has(id))
      .map(([id, values]) => [id, uniqueSkills(values)]),
  )
  if (
    Object.keys(grantedChoiceSelections).length
    !== Object.keys(draft.skillChoices.grantedChoiceSelections).length
  ) {
    changes.push('Выборы, принадлежавшие прежнему классу или предыстории, очищены.')
  }

  draft = {
    ...draft,
    ancestryId: ancestry?.id ?? draft.ancestryId,
    attributeChoices: {
      ...draft.attributeChoices,
      ancestryFreeBoosts: ancestryBoosts,
      backgroundLimitedBoost,
      backgroundFreeBoost,
      classKeyBoost,
      finalFreeBoosts: Array.from(new Set(draft.attributeChoices.finalFreeBoosts)).slice(0, 4),
    },
    skillChoices: {
      ...draft.skillChoices,
      grantedChoiceSelections,
      classFreeSkills: uniqueSkills(draft.skillChoices.classFreeSkills),
      intelligenceSkills: uniqueSkills(draft.skillChoices.intelligenceSkills),
      suggestedSkills: uniqueSkills(draft.skillChoices.suggestedSkills),
    },
  }

  const automaticSkills = new Set(
    getSkillRuleBlocks(draft, catalog).grants.map(grant => grant.skillId),
  )
  const usedSkills = new Set(automaticSkills)
  let removedConflictingSkill = false
  const compatibleGrantedChoices = Object.fromEntries(
    Object.entries(draft.skillChoices.grantedChoiceSelections).map(([id, values]) => [
      id,
      values.filter(skillId => {
        if (usedSkills.has(skillId)) {
          removedConflictingSkill = true
          return false
        }
        usedSkills.add(skillId)
        return true
      }),
    ]),
  )
  const compatibleClassFree = draft.skillChoices.classFreeSkills.filter(skillId => {
    if (usedSkills.has(skillId)) {
      removedConflictingSkill = true
      return false
    }
    usedSkills.add(skillId)
    return true
  })
  const compatibleIntelligence = draft.skillChoices.intelligenceSkills.filter(skillId => {
    if (usedSkills.has(skillId)) {
      removedConflictingSkill = true
      return false
    }
    usedSkills.add(skillId)
    return true
  })
  if (removedConflictingSkill) {
    changes.push('Навыки, ставшие автоматическими или дублирующимися, очищены из блоков выбора.')
  }
  draft = {
    ...draft,
    skillChoices: {
      ...draft.skillChoices,
      grantedChoiceSelections: compatibleGrantedChoices,
      classFreeSkills: compatibleClassFree,
      intelligenceSkills: compatibleIntelligence,
    },
  }

  const attributes = calculateAttributeModifiers(draft, catalog)
  const calculatedSkills = calculateSkills(draft, catalog, attributes.modifiers)
  const activeReplacementIds = new Set(
    calculatedSkills.replacementChoices.map(choice => choice.id),
  )
  const replacementSkills = Object.fromEntries(
    Object.entries(draft.skillChoices.replacementSkills)
      .filter(([id]) => activeReplacementIds.has(id)),
  )
  if (
    Object.keys(replacementSkills).length
    !== Object.keys(draft.skillChoices.replacementSkills).length
  ) {
    changes.push('Устаревшие замены повторного обучения очищены.')
  }
  draft = {
    ...draft,
    skillChoices: { ...draft.skillChoices, replacementSkills },
  }

  if (previous.classId !== draft.classId && previous.subclassId) {
    changes.push('Путь прежнего класса очищен.')
  }
  return { draft, changes: Array.from(new Set(changes)) }
}

export function clearRulesRebuildWhenConfirmed(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
) {
  if (!draft.needsRulesRebuild) return draft
  const build = buildCharacter(draft, catalog)
  const hasRulesErrors = build.validationIssues.some(issue => (
    issue.severity === 'error'
    && (issue.step === 'final-attributes' || issue.step === 'features')
  ))
  return hasRulesErrors ? draft : { ...draft, needsRulesRebuild: false }
}
