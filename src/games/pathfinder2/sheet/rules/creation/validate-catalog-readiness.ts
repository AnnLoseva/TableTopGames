import { getClassById } from '../../data/selectors'
import type {
  Pathfinder2BuilderStepId,
  Pathfinder2CatalogAvailability,
  Pathfinder2CatalogId,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'

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
      'feats',
      'Справочник черт народов не подключён; обязательную черту народа проверить нельзя.',
    ))
  }

  const classFeats = unavailable(availability, 'class-feats')
  if (classFeats && draft.classId) {
    issues.push(issueFor(
      classFeats,
      'feats',
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
      'feats',
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

  const languages = unavailable(availability, 'languages')
  if (languages) {
    issues.push(issueFor(
      languages,
      'equipment',
      'Каталог языков не подключён; автоматические и свободные языки проверить нельзя.',
    ))
  }

  const characterClass = getClassById(catalog, draft.classId)
  const spells = unavailable(availability, 'spells')
  if (spells && characterClass?.spellTradition) {
    issues.push(issueFor(
      spells,
      'feats',
      'Файл заклинаний присутствует, но spellcasting rules engine ещё не подключён.',
    ))
  }

  return issues
}
