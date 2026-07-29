import { getAncestryById } from '../../data/selectors'
import type {
  Pathfinder2CalculatedLanguages,
  Pathfinder2CharacterDraftV4,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'

export function calculateLanguages(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
  intelligenceModifier: number,
): Pathfinder2CalculatedLanguages {
  const ancestry = getAncestryById(catalog, draft.ancestry.ancestryId)
  const grantedLanguageIds = ancestry?.languageRules.grantedLanguageIds ?? []
  const baseChoiceCount = ancestry?.languageRules.bonusChoiceCount ?? null
  const choiceLimit = baseChoiceCount === null
    ? null
    : baseChoiceCount + Math.max(0, intelligenceModifier)
  const selectedLanguageIds = Array.from(new Set(draft.details.languageChoices))
  const knownIds = new Set(catalog.languages.map(language => language.id))
  const allowedIds = new Set(ancestry?.languageRules.bonusLanguageIds ?? [])
  const issues: Pathfinder2ValidationIssue[] = []

  if (choiceLimit !== null && selectedLanguageIds.length !== choiceLimit) {
    issues.push({
      id: 'languages.choice-count',
      severity: 'error',
      step: 'details',
      section: 'languages',
      field: 'languageChoices',
      message: `Дополнительные языки: выбрано ${selectedLanguageIds.length} из ${choiceLimit}.`,
    })
  }
  selectedLanguageIds.forEach(languageId => {
    if (!knownIds.has(languageId)) {
      issues.push({
        id: `languages.missing.${languageId}`,
        severity: 'error',
        step: 'details',
        section: 'languages',
        field: 'languageChoices',
        message: `Язык «${languageId}» отсутствует в каталоге.`,
      })
    } else if (allowedIds.size > 0 && !allowedIds.has(languageId)) {
      issues.push({
        id: `languages.unavailable.${languageId}`,
        severity: 'error',
        step: 'details',
        section: 'languages',
        field: 'languageChoices',
        message: `Язык «${languageId}» недоступен этому персонажу.`,
      })
    }
    if (grantedLanguageIds.includes(languageId)) {
      issues.push({
        id: `languages.duplicate.${languageId}`,
        severity: 'error',
        step: 'details',
        section: 'languages',
        field: 'languageChoices',
        message: 'Автоматически известный язык нельзя занимать свободным выбором.',
      })
    }
  })
  if (draft.details.customLanguages.length > 0) {
    issues.push({
      id: 'languages.custom-confirmation',
      severity: 'warning',
      step: 'details',
      section: 'languages',
      field: 'customLanguages',
      message: 'Домашние языки требуют подтверждения Мастера.',
    })
  }

  return {
    grantedLanguageIds,
    selectedLanguageIds,
    choiceLimit,
    issues,
  }
}
