import type { DisciplineRollEffectResult } from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type { RouseCheckResult } from '@/games/vampires/modules/table/types'

export function getBloodSurgeBonus(bloodPotency: number) {
  const potency = Math.max(0, Math.min(10, Math.floor(Number(bloodPotency) || 0)))
  if (potency <= 0) return 1
  if (potency <= 2) return 2
  if (potency <= 4) return 3
  if (potency <= 6) return 4
  if (potency <= 8) return 5
  return 6
}

export function getRouseWarning(result: RouseCheckResult) {
  if (!result.maxHungerWarning) return ''
  return 'Голод уже 5. Неудачное Испытание Крови на максимальном Голоде: нужна реакция Рассказчика / риск голодной ярости.'
}

export function getActivePenaltyDelta(
  result: DisciplineRollEffectResult | null | undefined,
  penaltyId: string,
) {
  return result?.modifiers.find(
    modifier => modifier.sourceKind === 'penalty'
      && modifier.id === `penalty:${penaltyId}`
      && modifier.active,
  )?.diceDelta || 0
}

export function getActiveRollModifierWarnings(
  result: DisciplineRollEffectResult | null | undefined,
) {
  return [
    ...(getActivePenaltyDelta(result, 'willpower_impairment')
      ? ['Трек Воли заполнен: ментальная или социальная проверка получает -2к10.']
      : []),
    ...(getActivePenaltyDelta(result, 'health_impairment')
      ? ['Шкала здоровья заполнена: физическая проверка получает -2к10.']
      : []),
  ]
}