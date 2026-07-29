'use client'

import { createPoolRollActions, type PoolRollActionsDeps } from '../services/pool-roll-actions'

export type { PoolRollActionsDeps, PoolRollSnapshot } from '../services/pool-roll-actions'

/** Master/preview pool rolls and contested roll requests. */
export function usePoolRollActions(deps: PoolRollActionsDeps) {
  return createPoolRollActions(deps)
}