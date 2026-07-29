import type { CharacterDerivedStats } from '@/games/vampires/core/vtm5/rules/derived-stats'
import type {
  DisciplineRollEffectContext,
  DisciplineRollEffectResult,
} from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type { NormalizedHealth } from './types'

type Vtm5HealthRules = typeof import('@/games/vampires/core/vtm5/rules/health')
type Vtm5DisciplineEffects = typeof import('@/games/vampires/core/vtm5/rules/disciplines/effects')
type Vtm5DisciplineCosts = typeof import('@/games/vampires/core/vtm5/rules/disciplines/costs')
type Vtm5DisciplineEngine = typeof import('@/games/vampires/core/vtm5/rules/disciplines/engine')
type Vtm5DisciplineActiveEffects = typeof import('@/games/vampires/core/vtm5/rules/disciplines/active-effects')
type Vtm5DisciplineDurations = typeof import('@/games/vampires/core/vtm5/rules/disciplines/durations')
type Vtm5HumanityRules = typeof import('@/games/vampires/core/vtm5/rules/humanity')

/** Extended health helpers beyond damage application. */
export type TableHealthExtendedAdapter = {
  calculateConflictDamage: Vtm5HealthRules['calculateConflictDamage']
  getHealthMetaState: Vtm5HealthRules['getHealthMetaState']
  getHealthWarning: Vtm5HealthRules['getHealthWarning']
  getSuperficialMendAmount: Vtm5HealthRules['getSuperficialMendAmount']
  normalizeDamageProfile: Vtm5HealthRules['normalizeDamageProfile']
  toHealthTracker: Vtm5HealthRules['toHealthTracker']
}

/** Health rules surface the table module expects from a game system. */
export type TableHealthAdapter = TableHealthExtendedAdapter & {
  getHealthImpairmentPenalty: Vtm5HealthRules['getHealthImpairmentPenalty']
  normalizeHealthTracker: Vtm5HealthRules['normalizeHealthTracker']
  applyHealthDamage: Vtm5HealthRules['applyHealthDamage']
  recoverHealthDamage: Vtm5HealthRules['recoverHealthDamage']
}

export type TableDisciplinesAdapter = {
  applyDisciplineEffectsToDamage: Vtm5DisciplineEffects['applyDisciplineEffectsToDamage']
  resolveDisciplineCost: Vtm5DisciplineCosts['resolveDisciplineCost']
  payDisciplineCost: Vtm5DisciplineCosts['payDisciplineCost']
  activateDisciplinePower: Vtm5DisciplineEngine['activateDisciplinePower']
  deactivateDisciplinePower: Vtm5DisciplineEngine['deactivateDisciplinePower']
  isDisciplinePowerActive: Vtm5DisciplineEngine['isDisciplinePowerActive']
  removeActiveEffect: Vtm5DisciplineActiveEffects['removeActiveEffect']
  getDisciplineDurationLabel: Vtm5DisciplineDurations['getDisciplineDurationLabel']
}

export type TableHumanityAdapter = {
  getHumanityState: Vtm5HumanityRules['getHumanityState']
  getHumanityStatus: Vtm5HumanityRules['getHumanityStatus']
  getHumanityWarning: Vtm5HumanityRules['getHumanityWarning']
  getRemorseDice: Vtm5HumanityRules['getRemorseDice']
  addHumanityStains: Vtm5HumanityRules['addHumanityStains']
}

/** VTM5 (or another system) implements this contract; table runtime reads it via configureTableModule. */
export type TableSystemAdapter = {
  readonly systemId: string
  readonly rulesNamespace: string
  health: TableHealthAdapter
  disciplines: TableDisciplinesAdapter
  humanity: TableHumanityAdapter
  getDerivedStats(characterData: unknown, rules?: unknown): CharacterDerivedStats
  applyDisciplineEffectsToRoll(
    rollContext: DisciplineRollEffectContext,
    derivedStats?: unknown,
  ): DisciplineRollEffectResult
}