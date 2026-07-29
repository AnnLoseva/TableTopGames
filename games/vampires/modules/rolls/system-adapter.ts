import type {
  countD10Successes,
  getDieKind,
  getRollOutcomeMeta,
  rollD10Pool,
  Vtm5RollDie,
} from '@/games/vampires/core/vtm5/rules/rolls'

export type RollsDie = Vtm5RollDie

export type RollsRollLike = {
  id: string
  poolType: string
  poolName: string
  meta?: { rollKind?: string }
  dice: RollsDie[]
}

export type RollsDiceAdapter = {
  getDieKind: typeof getDieKind
  rollD10Pool: typeof rollD10Pool
  countD10Successes: typeof countD10Successes
  getRollOutcomeMeta: typeof getRollOutcomeMeta
}

/** Roll rules surface the rolls module expects from a game system. */
export type RollsSystemAdapter = {
  readonly systemId: string
  readonly rulesNamespace: string
  dice: RollsDiceAdapter
  isWillpowerRerollExcluded(roll: RollsRollLike): boolean
  getWillpowerRerollEligibleDieIds(roll: RollsRollLike): string[]
}