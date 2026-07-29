'use client'

import { createRollPublishActions, type RollPublishActionsDeps } from '../services/roll-publish-actions'

export type { RollPublishActionsDeps }

/** Roll broadcast, persistence, and opposed-roll response handling. */
export function useRollPublishActions(deps: RollPublishActionsDeps) {
  return createRollPublishActions(deps)
}