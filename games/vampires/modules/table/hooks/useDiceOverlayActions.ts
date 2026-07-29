'use client'

import { createDiceOverlayActions, type DiceOverlayActionsDeps } from '../services/dice-overlay-actions'

export type { DiceOverlayActionsDeps }

/** 3D dice overlay queue and roll animation triggers. */
export function useDiceOverlayActions(deps: DiceOverlayActionsDeps) {
  return createDiceOverlayActions(deps)
}