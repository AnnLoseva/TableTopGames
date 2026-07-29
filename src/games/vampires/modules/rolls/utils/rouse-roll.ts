import type { CharacterOption, Die, RollMessage, RouseCheckResult } from '@/games/vampires/modules/table/types'
import type { RollsDiceAdapter } from '../system-adapter'
import { getRouseWarning } from './roll-helpers'

export function buildRouseCheckRoll(
  character: CharacterOption,
  room: string,
  result: RouseCheckResult,
  reason: string,
  rollsDice: RollsDiceAdapter,
  getBloodPotency: (character?: CharacterOption | null) => number,
): RollMessage {
  const die = { value: result.value, kind: rollsDice.getDieKind(result.value, false) } as Die
  const warning = getRouseWarning(result)
  return {
    id: result.id,
    room,
    characterName: character.name,
    poolName: reason,
    poolType: 'rouse-check',
    diceCount: 1,
    dice: [die],
    successes: result.success ? 1 : 0,
    createdAt: new Date().toISOString(),
    meta: {
      source: 'rouse_check',
      hungerBefore: result.hungerBefore,
      hungerAfter: result.hungerAfter,
      bloodPotency: getBloodPotency(character),
      rouseChecks: [result],
      warnings: warning ? [warning] : [],
    },
  }
}