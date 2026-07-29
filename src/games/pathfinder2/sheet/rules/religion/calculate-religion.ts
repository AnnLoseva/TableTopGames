import { getClassById } from '../../data/selectors'
import type {
  Pathfinder2CalculatedReligion,
  Pathfinder2CharacterDraftV4,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'

export function calculateReligion(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2CalculatedReligion {
  const characterClass = getClassById(catalog, draft.class.classId)
  const deity = catalog.deities.find(entry => entry.id === draft.details.deityId) ?? null
  const issues: Pathfinder2ValidationIssue[] = []

  if (characterClass?.requiresDeity && !deity) {
    issues.push({
      id: 'religion.deity-required',
      severity: 'error',
      step: 'details',
      section: 'religion',
      field: 'deityId',
      message: `Класс «${characterClass.name}» требует выбрать божество.`,
    })
  } else if (draft.details.deityId && !deity) {
    issues.push({
      id: 'religion.deity-missing',
      severity: 'error',
      step: 'details',
      section: 'religion',
      field: 'deityId',
      message: 'Выбранное божество отсутствует в каталоге.',
    })
  }
  if (
    deity
    && !deity.sanctifications.includes(draft.details.sanctification)
  ) {
    issues.push({
      id: 'religion.sanctification',
      severity: 'error',
      step: 'details',
      section: 'religion',
      field: 'sanctification',
      message: 'Выбранное освящение недоступно этому божеству.',
    })
  }

  return {
    deity,
    grantedEdicts: deity?.edicts ?? [],
    grantedAnathema: deity?.anathema ?? [],
    issues,
  }
}
