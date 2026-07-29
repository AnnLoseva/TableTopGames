import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2RulesCatalog,
} from '../types'
import { buildCharacterState } from './creation/build-character-state'

export function calculateDerivedStats(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
) {
  const state = buildCharacterState(draft, catalog)
  return {
    ...state.derived,
    inventory: state.inventory,
    attacks: state.attacks,
    spellcasting: state.spellcasting,
  }
}
