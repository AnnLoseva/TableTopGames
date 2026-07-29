import type {
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
} from '../../types'
import { calculateAttributeModifiers } from '../attributes/calculate-attributes'
import { calculateSkills } from '../skills/calculate-skills'
import { validateCharacterBuild } from './validate-character'

export function buildCharacter(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2CharacterBuild {
  const attributes = calculateAttributeModifiers(draft, catalog)
  const skills = calculateSkills(draft, catalog, attributes.modifiers)
  const validationIssues = validateCharacterBuild(
    draft,
    catalog,
    attributes,
    skills,
  )
  return {
    attributes,
    skills,
    validationIssues,
    isReady: !validationIssues.some(issue => issue.severity === 'error'),
  }
}
