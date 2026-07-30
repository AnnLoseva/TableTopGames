import { getBackgroundById, getClassById } from '../../data/selectors'
import type {
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'
import {
  calculateAttributeModifiers,
  getAncestryAttributeRules,
} from './calculate-attributes'

function duplicateCount(values: string[]) {
  return values.length - new Set(values).size
}

export function validateAttributeChoices(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ValidationIssue[] {
  const issues: Pathfinder2ValidationIssue[] = []
  const ancestry = catalog.ancestries.find(value => value.id === draft.ancestryId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const ancestryRules = getAncestryAttributeRules(draft, catalog)
  const choices = draft.attributeChoices

  if (!ancestry) {
    issues.push({
      id: 'attributes.ancestry-required',
      severity: 'error',
      step: 'final-attributes',
      field: 'ancestryFreeBoosts',
      message: 'Сначала выберите народ.',
    })
  } else if (choices.ancestryFreeBoosts.length !== ancestryRules.freeBoostCount) {
    issues.push({
      id: 'attributes.ancestry-free-count',
      severity: 'error',
      step: 'final-attributes',
      field: 'ancestryFreeBoosts',
      message: `Распределите повышения народа: выбрано ${choices.ancestryFreeBoosts.length} из ${ancestryRules.freeBoostCount}.`,
    })
  }
  if (
    duplicateCount(choices.ancestryFreeBoosts) > 0
    || choices.ancestryFreeBoosts.some(key => ancestryRules.fixedBoosts.includes(key))
  ) {
    issues.push({
      id: 'attributes.ancestry-duplicate',
      severity: 'error',
      step: 'final-attributes',
      field: 'ancestryFreeBoosts',
      message: 'На этапе народа одну характеристику нельзя повысить дважды.',
    })
  }
  if (duplicateCount(choices.voluntaryFlaws) > 0) {
    issues.push({
      id: 'attributes.voluntary-flaw-duplicate',
      severity: 'error',
      step: 'final-attributes',
      field: 'voluntaryFlaws',
      message: 'К одной характеристике можно применить только одно добровольное понижение.',
    })
  }
  if (ancestryRules.flaw && choices.voluntaryFlaws.includes(ancestryRules.flaw)) {
    issues.push({
      id: 'attributes.voluntary-flaw-stacks-ancestry',
      severity: 'error',
      step: 'final-attributes',
      field: 'voluntaryFlaws',
      message: 'Характеристика уже понижена народом — к ней нельзя применить второе понижение.',
    })
  }

  if (!background) {
    issues.push({
      id: 'attributes.background-required',
      severity: 'error',
      step: 'final-attributes',
      field: 'backgroundLimitedBoost',
      message: 'Сначала выберите предысторию.',
    })
  } else if (background.abilityBoostOptions.length === 0) {
    issues.push({
      id: 'attributes.background-data-missing',
      severity: 'error',
      step: 'final-attributes',
      field: 'backgroundLimitedBoost',
      message: `Для предыстории «${background.name}» в справочнике не указаны варианты повышения характеристик.`,
    })
  } else if (
    !choices.backgroundLimitedBoost
    || !background.abilityBoostOptions.includes(choices.backgroundLimitedBoost)
  ) {
    issues.push({
      id: 'attributes.background-limited',
      severity: 'error',
      step: 'final-attributes',
      field: 'backgroundLimitedBoost',
      message: 'Выберите одно из двух повышений, разрешённых предысторией.',
    })
  }
  if (!choices.backgroundFreeBoost) {
    issues.push({
      id: 'attributes.background-free',
      severity: 'error',
      step: 'final-attributes',
      field: 'backgroundFreeBoost',
      message: 'Выберите свободное повышение предыстории.',
    })
  } else if (choices.backgroundFreeBoost === choices.backgroundLimitedBoost) {
    issues.push({
      id: 'attributes.background-duplicate',
      severity: 'error',
      step: 'final-attributes',
      field: 'backgroundFreeBoost',
      message: 'Два повышения предыстории должны применяться к разным характеристикам.',
    })
  }

  if (!characterClass) {
    issues.push({
      id: 'attributes.class-required',
      severity: 'error',
      step: 'final-attributes',
      field: 'classKeyBoost',
      message: 'Сначала выберите класс.',
    })
  } else if (
    !choices.classKeyBoost
    || !characterClass.keyAbilities.includes(choices.classKeyBoost)
  ) {
    issues.push({
      id: 'attributes.class-key',
      severity: 'error',
      step: 'final-attributes',
      field: 'classKeyBoost',
      message: 'Выберите разрешённую классу ключевую характеристику.',
    })
  }

  if (
    choices.finalFreeBoosts.length !== 4
    || duplicateCount(choices.finalFreeBoosts) > 0
  ) {
    issues.push({
      id: 'attributes.final-free-count',
      severity: 'error',
      step: 'final-attributes',
      field: 'finalFreeBoosts',
      message: `Распределите четыре разных свободных повышения: выбрано ${new Set(choices.finalFreeBoosts).size} из 4.`,
    })
  }

  const calculated = calculateAttributeModifiers(draft, catalog)
  for (const [key, value] of Object.entries(calculated.modifiers)) {
    if (draft.level === 1 && value > 4) {
      issues.push({
        id: `attributes.maximum.${key}`,
        severity: 'error',
        step: 'final-attributes',
        field: key,
        message: 'На 1-м уровне характеристика не может быть выше +4.',
      })
    }
    if (value < -1) {
      issues.push({
        id: `attributes.minimum.${key}`,
        severity: 'error',
        step: 'final-attributes',
        field: key,
        message: 'Итоговая характеристика не может быть ниже −1.',
      })
    }
  }

  return issues
}
