'use client'

import {
  createRollAttributeActions,
  type RollAttributeActionsDeps,
} from '../services/roll-attribute-actions'

export type { RollAttributeActionsDeps }

/** Preview roll attribute pair toggling. */
export function useRollAttributeActions(deps: RollAttributeActionsDeps) {
  return createRollAttributeActions(deps)
}