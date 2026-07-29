import type { DamageSeverity, HealthDamageOptions } from '@/games/vampires/core/vtm5/rules/health'
import { tableHealth } from '../system-runtime'
import type { CharacterOption, RollMessage } from '../types'

export type RollDamageActionsDeps = {
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  chatCharacters: CharacterOption[]
  getRollCharacter: (roll: RollMessage) => CharacterOption | null
  applyCharacterHealthDamage: (
    character: CharacterOption,
    amount: number,
    severity: DamageSeverity,
    options?: HealthDamageOptions,
  ) => Promise<unknown>
}

export function createRollDamageActions(deps: RollDamageActionsDeps) {
  const applyRollDamage = async (roll: RollMessage) => {
    if (!deps.chatCharacters.length) {
      window.alert(deps.t('На столе нет доступных целей.'))
      return
    }
    const targetList = deps.chatCharacters.map((character, index) => `${index + 1}. ${character.name}`).join('\n')
    const targetIndex = Number(window.prompt(deps.tf('Выбери цель:\n{list}', { list: targetList }), '1') || 0) - 1
    const target = deps.chatCharacters[targetIndex]
    if (!target) return
    const sourceCharacter = deps.getRollCharacter(roll)
    const opposedMargin = roll.opposed
      ? Math.abs((roll.opposed.sides[0]?.successes || 0) - (roll.opposed.sides[1]?.successes || 0))
      : roll.successes
    const margin = Math.max(0, Number(window.prompt(deps.t('Разница успехов:'), String(opposedMargin)) || 0))
    const weaponModifier = Number(window.prompt(deps.t('Модификатор оружия:'), '0') || 0)
    const severity: DamageSeverity = window.confirm(deps.t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'))
      ? 'aggravated'
      : 'superficial'
    const halveSuperficial = severity === 'superficial'
      ? window.confirm(deps.t('Делить лёгкий урон пополам с округлением вверх?'))
      : false
    const amount = tableHealth().calculateConflictDamage({ margin, weaponModifier })
    if (amount < 1) {
      window.alert(deps.t('Итоговый урон равен нулю.'))
      return
    }
    await deps.applyCharacterHealthDamage(target, amount, severity, {
      source: 'physical_conflict',
      sourceCharacterData: sourceCharacter || undefined,
      attackType: 'physical_conflict',
      margin,
      weaponModifier,
      halveSuperficial,
      ignoreHalving: severity === 'superficial' && !halveSuperficial,
      notes: [deps.tf('Урон применён из броска «{poolName}».', { poolName: deps.t(roll.poolName) })],
    })
  }

  const promptCharacterHealthDamage = async (character: CharacterOption) => {
    const amount = Math.max(0, Number(window.prompt(deps.t('Сколько урона нанести?'), '1') || 0))
    if (amount < 1) return
    const severity: DamageSeverity = window.confirm(deps.t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'))
      ? 'aggravated'
      : 'superficial'
    const halveSuperficial = severity === 'superficial'
      ? window.confirm(deps.t('Делить лёгкий урон пополам с округлением вверх?'))
      : false
    const note = window.prompt(deps.t('Комментарий к урону (необязательно):'), '') || ''
    await deps.applyCharacterHealthDamage(character, amount, severity, {
      source: 'manual',
      halveSuperficial,
      ignoreHalving: severity === 'superficial' && !halveSuperficial,
      notes: note ? [note] : [],
    })
  }

  return {
    applyRollDamage,
    promptCharacterHealthDamage,
  }
}