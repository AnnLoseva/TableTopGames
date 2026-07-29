import type { RollsRollLike, RollsSystemAdapter } from '@/games/vampires/modules/rolls/system-adapter'
import {
  countD10Successes,
  getDieKind,
  getRollOutcomeMeta,
  rollD10Pool,
} from '../rules/rolls'

function getRollDieId(roll: RollsRollLike, index: number) {
  return roll.dice[index]?.id || `${roll.id}:${index}`
}

export function createVtm5RollsAdapter(): RollsSystemAdapter {
  return {
    systemId: 'vtm5',
    rulesNamespace: 'vtm5',
    dice: {
      getDieKind,
      rollD10Pool,
      countD10Successes,
      getRollOutcomeMeta,
    },
    isWillpowerRerollExcluded(roll) {
      const text = `${roll.poolType} ${roll.poolName}`.toLocaleLowerCase('ru')
      return roll.poolType === 'rouse-check'
        || roll.poolType === 'willpower'
        || roll.poolType === 'willpower-check'
        || roll.poolType === 'humanity-check'
        || roll.poolType === 'remorse-check'
        || roll.meta?.rollKind === 'humanity_check'
        || roll.meta?.rollKind === 'remorse_check'
        || /проверка воли|вол[яи]|человеч|willpower|humanity/.test(text)
    },
    getWillpowerRerollEligibleDieIds(roll) {
      return roll.dice
        .map((die, index) => ({ die, id: getRollDieId(roll, index) }))
        .filter(({ die }) => !String(die.kind).startsWith('hunger'))
        .map(({ id }) => id)
    },
  }
}