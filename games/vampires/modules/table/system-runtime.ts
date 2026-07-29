import { getTableSystemAdapter } from './configure'

/** Health rules from the wired game-system adapter (VTM5 by default). */
export function tableHealth() {
  return getTableSystemAdapter().health
}

export function tableDisciplines() {
  return getTableSystemAdapter().disciplines
}

export function tableHumanity() {
  return getTableSystemAdapter().humanity
}

export function tableGetDerivedStats(characterData: unknown, rules?: unknown) {
  return getTableSystemAdapter().getDerivedStats(characterData, rules)
}

export function tableApplyDisciplineEffectsToRoll(
  rollContext: Parameters<ReturnType<typeof getTableSystemAdapter>['applyDisciplineEffectsToRoll']>[0],
  derivedStats?: unknown,
) {
  return getTableSystemAdapter().applyDisciplineEffectsToRoll(rollContext, derivedStats)
}