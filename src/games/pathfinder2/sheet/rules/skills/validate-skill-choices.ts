import type {
  Pathfinder2CalculatedSkills,
  Pathfinder2CharacterDraft,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillId,
  Pathfinder2ValidationIssue,
} from '../../types'
import { validateSkillIncreases } from '../progression/skill-progression'
import { getSkillRuleBlocks } from './calculate-skills'

function duplicates(values: Pathfinder2SkillId[]) {
  return values.filter((value, index) => values.indexOf(value) !== index)
}

export function validateSkillChoices(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
  calculated: Pathfinder2CalculatedSkills,
): Pathfinder2ValidationIssue[] {
  const issues: Pathfinder2ValidationIssue[] = []
  const { grants, choiceRules, characterClass } = getSkillRuleBlocks(draft, catalog)

  if (!draft.backgroundId) {
    issues.push({
      id: 'skills.background-required',
      severity: 'error',
      step: 'skills',
      message: 'Сначала выберите предысторию.',
    })
  }
  if (!characterClass) {
    issues.push({
      id: 'skills.class-required',
      severity: 'error',
      step: 'skills',
      message: 'Сначала выберите класс.',
    })
  }

  choiceRules.forEach(rule => {
    const selected = draft.skillChoices.grantedChoiceSelections[rule.id] ?? []
    const allowed = rule.allowedSkills
    const excluded = rule.excludedSkills ?? []
    if (
      selected.length !== rule.count
      || duplicates(selected).length > 0
      || selected.some(skillId => (
        (allowed && !allowed.includes(skillId)) || excluded.includes(skillId)
      ))
    ) {
      issues.push({
        id: `skills.granted-choice.${rule.id}`,
        severity: 'error',
        step: 'skills',
        field: `grantedChoiceSelections.${rule.id}`,
        message: `${rule.label}: выберите ровно ${rule.count} допустимый навык.`,
      })
    }
  })

  const automaticSkillIds = new Set(grants.map(grant => grant.skillId))
  const selectedGroups = [
    ...choiceRules.flatMap(rule => (
      draft.skillChoices.grantedChoiceSelections[rule.id] ?? []
    )),
    ...draft.skillChoices.classFreeSkills,
    ...draft.skillChoices.intelligenceSkills,
    ...Object.values(draft.skillChoices.replacementSkills),
  ]
  const illegalDuplicates = new Set([
    ...duplicates(selectedGroups),
    ...selectedGroups.filter(skillId => automaticSkillIds.has(skillId)),
  ])
  if (illegalDuplicates.size > 0) {
    issues.push({
      id: 'skills.choice-duplicate',
      severity: 'error',
      step: 'skills',
      field: 'skillChoices',
      message: 'Один навык нельзя занять сразу несколькими источниками выбора.',
    })
  }

  const classSelected = draft.skillChoices.classFreeSkills
  if (classSelected.length !== calculated.classFreeLimit) {
    issues.push({
      id: classSelected.length > calculated.classFreeLimit
        ? 'skills.class-free.too-many'
        : 'skills.class-free.too-few',
      severity: 'error',
      step: 'skills',
      field: 'classFreeSkills',
      message: `Дополнительные навыки класса: выбрано ${classSelected.length} из ${calculated.classFreeLimit}.`,
    })
  }
  const intelligenceSelected = draft.skillChoices.intelligenceSkills
  if (intelligenceSelected.length !== calculated.intelligenceLimit) {
    issues.push({
      id: intelligenceSelected.length > calculated.intelligenceLimit
        ? 'skills.intelligence.too-many'
        : 'skills.intelligence.too-few',
      severity: 'error',
      step: 'skills',
      field: 'intelligenceSkills',
      message: `Интеллект даёт ${calculated.intelligenceLimit} дополнительных навыков; выбрано ${intelligenceSelected.length}.`,
    })
  }

  calculated.replacementChoices.forEach(replacement => {
    const selected = draft.skillChoices.replacementSkills[replacement.id]
    if (!selected || automaticSkillIds.has(selected)) {
      issues.push({
        id: `skills.replacement.${replacement.id}`,
        severity: 'error',
        step: 'skills',
        field: `replacementSkills.${replacement.id}`,
        message: `Повторное обучение навыку требует выбрать допустимую замену.`,
      })
    }
  })

  const initialRanks = Object.fromEntries(
    Object.entries(calculated.skills).map(([skillId, skill]) => [
      skillId,
      skill.sources.some(source => source.kind !== 'increase') ? 'trained' : 'untrained',
    ]),
  ) as Record<string, Pathfinder2ProficiencyRank>
  issues.push(...validateSkillIncreases(draft, catalog, initialRanks))
  return issues
}
