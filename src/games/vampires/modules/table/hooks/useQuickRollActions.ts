'use client'

import { createQuickRollActions, type QuickRollActionsDeps } from '../services/quick-roll-actions'

export type { QuickRollActionsDeps }

/** Quick dice rolls and blood surge factory wiring. */
export function useQuickRollActions(deps: QuickRollActionsDeps) {
  return createQuickRollActions(deps)
}