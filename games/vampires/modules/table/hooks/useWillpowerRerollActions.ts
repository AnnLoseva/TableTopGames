'use client'

import {
  createWillpowerRerollActions,
  type WillpowerRerollActionsDeps,
} from '../services/willpower-reroll-actions'

export type { WillpowerRerollActionsDeps }

/** Willpower reroll selection, validation, and roll replacement. */
export function useWillpowerRerollActions(deps: WillpowerRerollActionsDeps) {
  return createWillpowerRerollActions(deps)
}