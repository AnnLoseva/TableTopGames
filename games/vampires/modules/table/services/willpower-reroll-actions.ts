import type { Dispatch, SetStateAction } from 'react'
import type { DiceOverlayRoll } from '@/games/vampires/modules/rolls/components/DiceRollOverlay'
import { applyWillpowerRerollToDice } from '@/games/vampires/modules/rolls/utils'
import { rollsDice } from '@/games/vampires/modules/rolls/system-runtime'
import type { CharacterOption, RollMessage, WillpowerRerollDraft } from '../types'
import { getCharacterWillpower, getWillpowerMetaState } from '../utils/character-state'
import {
  getRollDieId,
  getWillpowerRerollEligibleDieIds,
  isWillpowerRerollExcluded,
} from '../utils/roll-utils'

export type WillpowerRerollActionsDeps = {
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  isMaster: boolean
  willpowerRerollDraft: WillpowerRerollDraft | null
  setWillpowerRerollDraft: Dispatch<SetStateAction<WillpowerRerollDraft | null>>
  getRollCharacter: (roll: RollMessage) => CharacterOption | null
  spendWillpower: (character: CharacterOption, amount: number, reason: string) => Promise<{
    before: ReturnType<typeof getCharacterWillpower>
    after: ReturnType<typeof getCharacterWillpower>
    spent: number
    warnings: string[]
  } | null>
  queueDiceOverlayRoll: (overlayRoll: DiceOverlayRoll) => void
  publishRollReplacement: (roll: RollMessage) => Promise<void>
}

export function createWillpowerRerollActions(deps: WillpowerRerollActionsDeps) {
  const canUseWillpowerReroll = (roll: RollMessage) => {
    if (roll.opposed || (roll.hidden && !deps.isMaster) || roll.meta?.willpowerReroll?.used || isWillpowerRerollExcluded(roll)) {
      return false
    }
    if (!getWillpowerRerollEligibleDieIds(roll).length) return false
    const character = deps.getRollCharacter(roll)
    if (!character) return false
    const willpower = getCharacterWillpower(character)
    return willpower.max > 0 && willpower.aggravated < willpower.max
  }

  const toggleWillpowerRerollDie = (roll: RollMessage, dieId: string) => {
    if (!canUseWillpowerReroll(roll)) return
    deps.setWillpowerRerollDraft(current => {
      const selected = current?.rollId === roll.id ? current.selectedDieIds : []
      if (selected.includes(dieId)) {
        return { rollId: roll.id, selectedDieIds: selected.filter(id => id !== dieId) }
      }
      if (selected.length >= 3) return { rollId: roll.id, selectedDieIds: selected }
      return { rollId: roll.id, selectedDieIds: [...selected, dieId] }
    })
  }

  const confirmWillpowerReroll = async (roll: RollMessage) => {
    const draft = deps.willpowerRerollDraft?.rollId === roll.id ? deps.willpowerRerollDraft : null
    if (!draft || draft.selectedDieIds.length < 1) {
      window.alert(deps.t('Выбери от одного до трёх обычных кубиков.'))
      return
    }
    const character = deps.getRollCharacter(roll)
    if (!character) {
      window.alert(deps.t('Не удалось найти персонажа для траты Воли.'))
      return
    }
    const spendResult = await deps.spendWillpower(character, 1, deps.tf('Воля: переброс · {poolName}', { poolName: deps.t(roll.poolName) }))
    if (!spendResult) return

    const { rerolledDice, oldDice, newDice, successes, outcomeMeta } = applyWillpowerRerollToDice(
      roll,
      draft.selectedDieIds,
      rollsDice(),
      getRollDieId,
    )
    const previousWarnings = roll.meta?.warnings || []
    const updatedRoll: RollMessage = {
      ...roll,
      dice: rerolledDice,
      diceCount: rerolledDice.length,
      successes,
      meta: {
        ...(roll.meta || {}),
        characterId: character.id,
        willpowerBefore: getWillpowerMetaState(spendResult.before),
        willpowerAfter: getWillpowerMetaState(spendResult.after),
        spentWillpower: (roll.meta?.spentWillpower || 0) + spendResult.spent,
        willpowerImpaired: spendResult.after.impaired,
        willpowerReroll: {
          used: true,
          selectedDieIds: draft.selectedDieIds,
          oldDice,
          newDice,
        },
        warnings: [...previousWarnings, ...spendResult.warnings],
        ...outcomeMeta,
      },
    }
    deps.setWillpowerRerollDraft(null)
    deps.queueDiceOverlayRoll({
      id: `${updatedRoll.id}-reroll`,
      title: `${updatedRoll.characterName} · ${deps.t('Переброс Воли')}`,
      groups: [{ key: 'main', label: '', dice: newDice.map(die => ({ value: die.value, kind: die.kind })) }],
    })
    await deps.publishRollReplacement(updatedRoll)
  }

  return {
    canUseWillpowerReroll,
    toggleWillpowerRerollDie,
    confirmWillpowerReroll,
  }
}