import type { MutableRefObject } from 'react'
import type { QuickRollOptions } from '@/games/vampires/modules/rolls/types'
import { createQuickRollFactory } from '@/games/vampires/modules/rolls/hooks'
import { rollsDice } from '@/games/vampires/modules/rolls/system-runtime'
import type { CharacterOption, RouseCheckResult } from '../types'
import { tableApplyDisciplineEffectsToRoll } from '../system-runtime'
import type { DisciplineRule } from '../utils/discipline-ui'
import {
  getCharacterBloodPotency,
  getCharacterHealth,
  getCharacterHunger,
  getCharacterWillpower,
  getWillpowerMetaState,
} from '../utils/character-state'

export type QuickRollActionsDeps = {
  room: string
  t: (ru: string) => string
  isMaster: boolean
  disciplineRules: Record<string, DisciplineRule> | null
  selectedActiveCharacter: CharacterOption | null
  createQuickRollRef: MutableRefObject<ReturnType<typeof createQuickRollFactory>>
  rollQuickDiceRef: MutableRefObject<(
    diceCount?: number,
    poolName?: string,
    characterOverride?: CharacterOption,
    poolType?: string,
    options?: QuickRollOptions,
  ) => Promise<void>>
  performRouseCheck: (
    character: CharacterOption,
    reason: string,
    hungerBefore?: number,
  ) => Promise<RouseCheckResult>
  publishRoll: (roll: import('../types').RollMessage) => Promise<void>
}

export function createQuickRollActions(deps: QuickRollActionsDeps) {
  const createQuickRoll = createQuickRollFactory({
    room: deps.room,
    isMaster: deps.isMaster,
    disciplineRules: deps.disciplineRules,
    rollsDice: rollsDice(),
    applyDisciplineEffectsToRoll: tableApplyDisciplineEffectsToRoll,
    performRouseCheck: deps.performRouseCheck,
    getCharacterHunger,
    getCharacterWillpower,
    getCharacterBloodPotency,
    getCharacterHealth,
    getWillpowerMetaState,
  })
  deps.createQuickRollRef.current = createQuickRoll

  const rollQuickDice = async (
    diceCount = 1,
    poolName = deps.t('Быстрый бросок'),
    characterOverride?: CharacterOption,
    poolType = 'quick',
    options: QuickRollOptions = {},
  ) => {
    const character = characterOverride || deps.selectedActiveCharacter
    if (!character) {
      window.alert(deps.t('Сначала выбери активного персонажа.'))
      return
    }
    const roll = await createQuickRoll(diceCount, poolName, character, poolType, options)
    await deps.publishRoll(roll)
  }
  deps.rollQuickDiceRef.current = rollQuickDice

  return {
    createQuickRoll,
    rollQuickDice,
  }
}