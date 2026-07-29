'use client'

import { createRollDamageActions, type RollDamageActionsDeps } from '../services/roll-damage-actions'

export type { RollDamageActionsDeps }

/** Conflict damage from rolls and manual health damage prompts. */
export function useRollDamageActions(deps: RollDamageActionsDeps) {
  return createRollDamageActions(deps)
}