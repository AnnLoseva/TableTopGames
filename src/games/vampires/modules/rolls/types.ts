import type { Module } from '@/platform/hub'
import type {
  DisciplineRollEffectContext,
  DisciplineRollEffectResult,
  DisciplineRollPenalty,
} from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type { HumanityState } from '@/games/vampires/core/vtm5/rules/humanity'
import type {
  CharacterOption,
  Die,
  NormalizedHealth,
  NormalizedWillpower,
  OpposedRollResult,
  OpposedRollSide,
  RollMessage,
  RollMeta,
  RouseCheckResult,
  WillpowerMetaState,
} from '@/games/vampires/modules/table/types'
import type { RollsDiceAdapter } from './system-adapter'

export type RollsModule = Module<'rolls', 'vtm5'>

export type DisciplineRollContext = {
  name: string
  power: string
  level: number
  cost: string
}

export type QuickRollOptions = {
  hidden?: boolean
  useBloodSurge?: boolean
  skipHungerDice?: boolean
  source?: RollMeta['source']
  disciplineContext?: DisciplineRollContext
  rouseChecks?: RouseCheckResult[]
  warnings?: string[]
  willpowerBefore?: RollMeta['willpowerBefore']
  willpowerAfter?: RollMeta['willpowerAfter']
  spentWillpower?: number
  recoveredWillpower?: number
  impairmentPenaltyApplied?: number
  healthImpairmentPenaltyApplied?: number
  rollTraits?: string[]
  rollAction?: string
  rollKind?: string
  rollPenalties?: DisciplineRollPenalty[]
  disabledRollModifierIds?: string[]
}

export type ContestedOpponentOption = {
  id: string
  label: string
  actorKind: 'player' | 'npc'
  characterId: string | null
  userId?: string
}

export type BuildQuickRollDeps = {
  room: string
  isMaster: boolean
  disciplineRules: Record<string, unknown> | null
  rollsDice: RollsDiceAdapter
  applyDisciplineEffectsToRoll: (
    rollContext: DisciplineRollEffectContext,
    derivedStats?: unknown,
  ) => DisciplineRollEffectResult
  performRouseCheck: (
    character: CharacterOption,
    reason: string,
    hungerBefore?: number,
  ) => Promise<RouseCheckResult>
  getCharacterHunger: (character?: CharacterOption | null) => number
  getCharacterWillpower: (character?: CharacterOption | null) => NormalizedWillpower
  getCharacterBloodPotency: (character?: CharacterOption | null) => number
  getCharacterHealth: (character?: CharacterOption | null) => NormalizedHealth
  getWillpowerMetaState: (willpower: NormalizedWillpower) => WillpowerMetaState
}

export type RemorseCheckOutcome = {
  before: HumanityState
  remorseDice: number
  automaticFailure: boolean
  dice: Die[]
  successes: number
  success: boolean
  humanityAfter: number
  nextState: HumanityState
  poolName: string
  warnings: string[]
}

export type BuildOpposedAnswerRollInput = {
  room: string
  proposalId: string
  leftSide: OpposedRollSide
  rightSide: OpposedRollSide
  opponentUserId: string
  opponentCharacterId: string
  responseRollModifiers?: RollMeta['rollModifiers']
  rollDifficultyModifier?: number
  warnings?: string[]
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
}

export type BuildOpposedAnswerRollResult = {
  roll: RollMessage
  opposed: OpposedRollResult
}