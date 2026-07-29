import { getClassById } from '../../data/selectors'
import type {
  Pathfinder2BuilderStepId,
  Pathfinder2CatalogAvailability,
  Pathfinder2CatalogId,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'
import { hasClassProgression } from '../progression/class-progression'

function unavailable(
  availability: Pathfinder2CatalogAvailability[],
  id: Pathfinder2CatalogId,
) {
  const catalog = availability.find(entry => entry.id === id)
  return catalog && catalog.status !== 'connected' ? catalog : null
}

function issueFor(
  catalog: Pathfinder2CatalogAvailability,
  step: Pathfinder2BuilderStepId,
  message: string,
): Pathfinder2ValidationIssue {
  return {
    id: `catalog.${catalog.id}`,
    severity: 'error',
    step,
    section: 'catalog',
    field: catalog.id,
    message,
  }
}

export function validateCatalogReadiness(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ValidationIssue[] {
  const availability = catalog.dataAvailability
  if (!availability.length) return []

  const issues: Pathfinder2ValidationIssue[] = []
  const classCatalog = unavailable(availability, 'classes')
  if (classCatalog && draft.classId) {
    issues.push(issueFor(
      classCatalog,
      'class',
      'Структурированные начальные владения и прогрессия классов ещё не подключены.',
    ))
  }

  const ancestryFeats = unavailable(availability, 'ancestry-feats')
  if (ancestryFeats && draft.ancestryId) {
    issues.push(issueFor(
      ancestryFeats,
      'features',
      'Справочник черт народов не подключён; обязательную черту народа проверить нельзя.',
    ))
  }

  const classFeats = unavailable(availability, 'class-feats')
  if (classFeats && draft.classId) {
    issues.push(issueFor(
      classFeats,
      'features',
      'Справочник классовых черт не подключён; классовые слоты проверить нельзя.',
    ))
  }

  const generalFeats = unavailable(availability, 'general-feats')
  if (
    generalFeats
    && draft.generalFeatIds.length + draft.skillFeatIds.length > 0
  ) {
    issues.push(issueFor(
      generalFeats,
      'features',
      'Prerequisites выбранных черт ещё не представлены структурированными требованиями.',
    ))
  }

  const equipment = unavailable(availability, 'equipment')
  if (equipment) {
    issues.push(issueFor(
      equipment,
      'equipment',
      'Каталог снаряжения не подключён; бюджет, покупки и Bulk проверить нельзя.',
    ))
  }
  for (const id of ['weapons', 'armor', 'shields'] as const) {
    const itemCatalog = unavailable(availability, id)
    if (!itemCatalog) continue
    issues.push(issueFor(
      itemCatalog,
      'equipment',
      `${itemCatalog.label}: структурированные боевые поля не подключены.`,
    ))
  }

  const languages = unavailable(availability, 'languages')
  if (languages) {
    issues.push(issueFor(
      languages,
      'details',
      'Каталог языков не подключён; автоматические и свободные языки проверить нельзя.',
    ))
  }

  const characterClass = getClassById(catalog, draft.classId)
  const deities = unavailable(availability, 'deities')
  if (deities && characterClass?.requiresDeity) {
    issues.push(issueFor(
      deities,
      'details',
      `Класс «${characterClass.name}» требует божество, но каталог божеств не подключён.`,
    ))
  }
  const classProgression = unavailable(availability, 'class-progression')
  if (classProgression && draft.classId) {
    issues.push(issueFor(
      classProgression,
      'features',
      'Полная структурированная прогрессия выбранного класса 2–20 не подключена.',
    ))
  } else if (
    draft.classId
    && !hasClassProgression(catalog, draft.classId)
  ) {
    issues.push({
      id: `catalog.class-progression.${draft.classId}`,
      severity: 'error',
      step: 'features',
      section: 'catalog',
      field: 'class-progression',
      message: `Для выбранного класса «${characterClass?.name ?? draft.classId}» пока нет прогрессии 1–20.`,
    })
  }
  const spells = unavailable(availability, 'spells')
  if (spells && characterClass?.spellTradition) {
    issues.push(issueFor(
      spells,
      'features',
      'Каталог заклинаний или spellcasting rules engine недоступен.',
    ))
  }

  return issues
}
