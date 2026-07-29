import { ATTRIBUTE_NAME_EN, SKILL_NAME_EN } from '@/games/vampires/lib/i18n/ruleNames'
import { getRollsSystemAdapter, isRollsModuleConfigured } from '@/games/vampires/modules/rolls/configure'
export {
  getActivePenaltyDelta,
  getActiveRollModifierWarnings,
  getBloodSurgeBonus,
  getRouseWarning,
} from '@/games/vampires/modules/rolls/utils/roll-helpers'
import type { RollMessage } from '../types'

export function getRollDieId(roll: RollMessage, index: number) {
  return roll.dice[index]?.id || `${roll.id}:${index}`
}

export function isWillpowerRerollExcluded(roll: RollMessage) {
  if (isRollsModuleConfigured()) {
    return getRollsSystemAdapter().isWillpowerRerollExcluded(roll)
  }

  const text = `${roll.poolType} ${roll.poolName}`.toLocaleLowerCase('ru')
  return roll.poolType === 'rouse-check'
    || roll.poolType === 'willpower'
    || roll.poolType === 'willpower-check'
    || roll.poolType === 'humanity-check'
    || roll.poolType === 'remorse-check'
    || roll.meta?.rollKind === 'humanity_check'
    || roll.meta?.rollKind === 'remorse_check'
    || /проверка воли|вол[яи]|человеч|willpower|humanity/.test(text)
}

export function getWillpowerRerollEligibleDieIds(roll: RollMessage) {
  if (isRollsModuleConfigured()) {
    return getRollsSystemAdapter().getWillpowerRerollEligibleDieIds(roll)
  }

  return roll.dice
    .map((die, index) => ({ die, id: getRollDieId(roll, index) }))
    .filter(({ die }) => !String(die.kind).startsWith('hunger'))
    .map(({ id }) => id)
}

export function getExtraTraitNames(
  values: Record<string, unknown>,
  groups: ReadonlyArray<{ traits: readonly string[] }>,
) {
  const known = new Set(groups.flatMap(group => group.traits.flatMap(name => [
    name,
    ATTRIBUTE_NAME_EN[name] || SKILL_NAME_EN[name] || name,
  ])))
  return Object.keys(values).filter(name => !known.has(name)).sort((a, b) => a.localeCompare(b, 'ru'))
}