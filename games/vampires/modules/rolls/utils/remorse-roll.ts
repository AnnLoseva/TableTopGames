import { applyRemorseCheckResult, type HumanityState } from '@/games/vampires/core/vtm5/rules/humanity'
import type { Die, RollMessage } from '@/games/vampires/modules/table/types'
import type { RollsDiceAdapter } from '../system-adapter'
import type { RemorseCheckOutcome } from '../types'

export function computeRemorseCheckOutcome(params: {
  before: HumanityState
  remorseDice: number
  rollsDice: RollsDiceAdapter
  tf: (ru: string, vars: Record<string, string | number>) => string
  t: (ru: string) => string
}): RemorseCheckOutcome {
  const { before, remorseDice, rollsDice, tf, t } = params
  const automaticFailure = remorseDice <= 0
  const dice = automaticFailure ? [] as Die[] : rollsDice.rollD10Pool(remorseDice, 0) as Die[]
  const resolution = applyRemorseCheckResult(before, {
    remorseDice,
    diceValues: dice.map(die => die.value),
    checkedAt: new Date().toISOString(),
  })
  const { successes, success, humanityAfter, nextState } = resolution

  const poolName = automaticFailure
    ? tf('Проверка мук совести: свободных ячеек нет. Результат: автоматический провал. Человечность: {before} → {after}. Сомнения очищены.', { before: before.value, after: humanityAfter })
    : success
      ? tf('Проверка мук совести: {dice}d10. Результат: успех. Человечность остаётся {after}. Сомнения очищены: {stains} → 0.', { dice: remorseDice, after: humanityAfter, stains: before.stains })
      : tf('Проверка мук совести: {dice}d10. Результат: провал. Человечность: {before} → {after}. Сомнения очищены: {stains} → 0.', { dice: remorseDice, before: before.value, after: humanityAfter, stains: before.stains })

  const warnings = [
    t('Проверка мук совести не использует кубики Голода, Прилив Крови и переброс Воли.'),
    ...(humanityAfter <= 0
      ? [t('Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.')]
      : []),
  ]

  return {
    before,
    remorseDice,
    automaticFailure: resolution.automaticFailure,
    dice,
    successes,
    success,
    humanityAfter,
    nextState,
    poolName,
    warnings,
  }
}

export function buildRemorseCheckRoll(
  characterName: string,
  room: string,
  outcome: RemorseCheckOutcome,
): RollMessage {
  const now = new Date().toISOString()
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    room,
    characterName,
    poolName: outcome.poolName,
    poolType: 'remorse-check',
    diceCount: outcome.dice.length,
    dice: outcome.dice,
    successes: outcome.successes,
    createdAt: now,
    meta: {
      source: 'humanity',
      rollKind: 'remorse_check',
      hungerDice: 0,
      humanityBefore: outcome.before.value,
      humanityAfter: outcome.humanityAfter,
      stainsBefore: outcome.before.stains,
      stainsAfter: 0,
      remorseDice: outcome.remorseDice,
      automaticFailure: outcome.automaticFailure,
      humanityLost: !outcome.success,
      stainEvents: outcome.before.stainEvents || [],
      warnings: outcome.warnings,
    },
  }
}