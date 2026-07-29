import type { Die, RollMessage } from '@/games/vampires/modules/table/types'
import type { RollsDiceAdapter } from '../system-adapter'

export function applyWillpowerRerollToDice(
  roll: RollMessage,
  selectedDieIds: string[],
  rollsDice: RollsDiceAdapter,
  getRollDieId: (roll: RollMessage, index: number) => string,
) {
  const selected = new Set(selectedDieIds)
  const oldDice: Die[] = []
  const newDice: Die[] = []
  const rerolledDice = roll.dice.map((die, index) => {
    const id = getRollDieId(roll, index)
    const normalizedDie = { ...die, id }
    if (!selected.has(id)) return normalizedDie
    oldDice.push(normalizedDie)
    const value = Math.floor(Math.random() * 10) + 1
    const nextDie = { id, value, kind: rollsDice.getDieKind(value, false), rerolled: true } as Die
    newDice.push(nextDie)
    return nextDie
  })
  const successes = rollsDice.countD10Successes(rerolledDice)
  const outcomeMeta = rollsDice.getRollOutcomeMeta(rerolledDice, successes)
  return { rerolledDice, oldDice, newDice, successes, outcomeMeta }
}