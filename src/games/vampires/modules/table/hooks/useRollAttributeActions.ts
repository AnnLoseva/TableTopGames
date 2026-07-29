'use client'

import {
  createRollAttributeActions,
  type RollAttributeActionsDeps,
} from '../services/roll-attribute-actions'

export type { RollAttributeActionsDeps }

/** Master and preview roll attribute pair toggling. */
export function useRollAttributeActions(deps: RollAttributeActionsDeps) {
  return createRollAttributeActions(deps)
}