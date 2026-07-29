import type { CharacterOption } from '@/games/vampires/modules/table/types'
import type { BuildQuickRollDeps, QuickRollOptions } from '../types'
import { buildQuickRoll } from '../utils/quick-roll'

/** Builds quick-roll messages with injected table + rolls dependencies. */
export function createQuickRollFactory(deps: BuildQuickRollDeps) {
  return (
    diceCount: number,
    poolName: string,
    character: CharacterOption,
    poolType: string,
    options?: QuickRollOptions,
  ) => buildQuickRoll(deps, diceCount, poolName, character, poolType, options)
}