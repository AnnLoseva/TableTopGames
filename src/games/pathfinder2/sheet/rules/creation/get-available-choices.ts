import type {
  Pathfinder2CharacterState,
  Pathfinder2ClassChoiceDefinition,
  Pathfinder2FeatRule,
  Pathfinder2FeatSlot,
  Pathfinder2RulesCatalog,
} from '../../types'
import { getFeatAvailability } from '../feats/requirements'

export type Pathfinder2ChoiceContext =
  | { kind: 'feat'; slot: Pathfinder2FeatSlot }
  | { kind: 'class-choice'; definition: Pathfinder2ClassChoiceDefinition }

export function getAvailableChoices(
  state: Pathfinder2CharacterState,
  context: Pathfinder2ChoiceContext,
  catalog: Pathfinder2RulesCatalog,
) {
  if (context.kind === 'class-choice') {
    return context.definition.classId === state.draft.class.classId
      ? context.definition.options
      : []
  }
  const feats: Pathfinder2FeatRule[] = [
    ...catalog.generalFeats,
    ...catalog.skillFeats,
    ...catalog.mythicFeats,
  ]
  return feats.filter(feat => getFeatAvailability(feat, context.slot, state).available)
}
