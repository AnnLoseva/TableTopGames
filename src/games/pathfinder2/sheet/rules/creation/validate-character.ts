import {
  getAncestryById,
  getBackgroundById,
  getClassById,
  getHeritageById,
  getVersatileHeritageById,
} from '../../data/selectors'
import type {
  Pathfinder2CalculatedAttributes,
  Pathfinder2CalculatedSkills,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'
import { calculateAttributeModifiers } from '../attributes/calculate-attributes'
import { validateAttributeChoices } from '../attributes/validate-attribute-choices'
import { calculateSkills } from '../skills/calculate-skills'
import { validateSkillChoices } from '../skills/validate-skill-choices'
import { validateCatalogReadiness } from './validate-catalog-readiness'

export function validateCharacterBuild(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
  calculatedAttributes?: Pathfinder2CalculatedAttributes,
  calculatedSkills?: Pathfinder2CalculatedSkills,
): Pathfinder2ValidationIssue[] {
  const issues: Pathfinder2ValidationIssue[] = []
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const hasNormalHeritage = Boolean(draft.heritageId)
  const hasVersatileHeritage = Boolean(draft.versatileHeritageId)

  if (!draft.name.trim()) {
    issues.push({
      id: 'concept.name',
      severity: 'error',
      step: 'concept',
      field: 'name',
      message: 'Укажите имя персонажа.',
    })
  }
  if (!draft.concept.trim()) {
    issues.push({
      id: 'concept.description',
      severity: 'error',
      step: 'concept',
      field: 'concept',
      message: 'Кратко опишите концепцию персонажа.',
    })
  }
  if (!ancestry) {
    issues.push({
      id: 'ancestry.required',
      severity: 'error',
      step: 'ancestry',
      field: 'ancestryId',
      message: 'Выберите народ.',
    })
  }
  if (hasNormalHeritage && hasVersatileHeritage) {
    issues.push({
      id: 'heritage.mutually-exclusive',
      severity: 'error',
      step: 'heritage',
      message: 'Обычное и универсальное наследие нельзя выбрать одновременно.',
    })
  } else if (!hasNormalHeritage && !hasVersatileHeritage) {
    issues.push({
      id: 'heritage.required',
      severity: 'error',
      step: 'heritage',
      message: 'Выберите одно обычное или универсальное наследие.',
    })
  }
  if (
    hasNormalHeritage
    && !getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  ) {
    issues.push({
      id: 'heritage.wrong-ancestry',
      severity: 'error',
      step: 'heritage',
      field: 'heritageId',
      message: 'Выбранное наследие не принадлежит текущему народу.',
    })
  }
  if (
    hasVersatileHeritage
    && !getVersatileHeritageById(catalog, draft.versatileHeritageId)
  ) {
    issues.push({
      id: 'heritage.versatile-missing',
      severity: 'error',
      step: 'heritage',
      field: 'versatileHeritageId',
      message: 'Универсальное наследие больше не найдено в справочнике.',
    })
  }
  if (!getBackgroundById(catalog, draft.backgroundId)) {
    issues.push({
      id: 'background.required',
      severity: 'error',
      step: 'background',
      field: 'backgroundId',
      message: 'Выберите предысторию.',
    })
  }
  if (!getClassById(catalog, draft.classId)) {
    issues.push({
      id: 'class.required',
      severity: 'error',
      step: 'class',
      field: 'classId',
      message: 'Выберите класс.',
    })
  }
  if (draft.level > 1) {
    issues.push({
      id: 'progression.not-supported',
      severity: 'error',
      step: 'concept',
      field: 'level',
      message: 'Строгая прогрессия уровней 2–20 ещё не подключена к интерфейсу. Завершить можно персонажа 1-го уровня.',
    })
  }
  if (draft.needsRulesRebuild) {
    issues.push({
      id: 'migration.rules-rebuild',
      severity: 'warning',
      step: 'review',
      message: 'Черновик создан до автоматической проверки. Подтвердите характеристики и навыки.',
    })
  }

  const attributes = calculatedAttributes
    ?? calculateAttributeModifiers(draft, catalog)
  const skills = calculatedSkills
    ?? calculateSkills(draft, catalog, attributes.modifiers)
  issues.push(...validateAttributeChoices(draft, catalog))
  issues.push(...validateSkillChoices(draft, catalog, skills))
  issues.push(...validateCatalogReadiness(draft, catalog))

  return Array.from(new Map(issues.map(issue => [issue.id, issue])).values())
}
