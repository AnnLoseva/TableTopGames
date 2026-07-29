import type { Dispatch, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { DEFAULT_OPPOSED_RESPONSE } from '@/games/vampires/modules/rolls/constants'
import {
  buildAnsweredOpposedRoll,
  getActiveRollModifierWarnings,
} from '@/games/vampires/modules/rolls/utils'
import { rollsDice } from '@/games/vampires/modules/rolls/system-runtime'
import { insertRollRecord, updateRollRecord } from '../api/roll-api'
import type {
  CharacterOption,
  Die,
  OpposedRollProposal,
  OpposedRollResult,
  OpposedRollSide,
  RollMessage,
  RollPoolBuilder,
} from '../types'
import { mergeRoll } from '../utils/layer-utils'
import { getOpposedCharacterPool } from '../utils/contested-roll-helpers'
import type { DisciplineRule } from '../utils/discipline-ui'
import { getCharacterHunger } from '../utils/character-state'

export type RollPublishActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  d10: (count: number) => string
  chatUser: ChatUser | null
  disciplineRules: Record<string, DisciplineRule> | null
  selectedActiveCharacter: CharacterOption | null
  opposedResponseSide: RollPoolBuilder
  incomingOpposedProposal: OpposedRollProposal | null
  setRolls: Dispatch<SetStateAction<RollMessage[]>>
  setConnectionText: Dispatch<SetStateAction<string>>
  setIncomingOpposedProposal: Dispatch<SetStateAction<OpposedRollProposal | null>>
  setOpposedResponseSide: Dispatch<SetStateAction<RollPoolBuilder>>
  broadcast: (event: string, payload: unknown) => void
  triggerDiceOverlay: (roll: RollMessage) => void
}

export function createRollPublishActions(deps: RollPublishActionsDeps) {
  const opposedPoolContext = {
    t: deps.t,
    d10: deps.d10,
    disciplineRules: deps.disciplineRules,
  }

  const publishRoll = async (roll: RollMessage) => {
    deps.setRolls(prev => mergeRoll(prev, roll))
    deps.triggerDiceOverlay(roll)
    if (roll.hidden) {
      deps.setConnectionText('Скрытый бросок')
      return
    }

    deps.broadcast('roll', roll)
    const { error } = await insertRollRecord(roll)

    if (error) deps.setConnectionText('Бросок отправлен онлайн, но не сохранился')
    else deps.setConnectionText('Онлайн')
  }

  const publishOpposedRoll = async (roll: RollMessage, opposed: OpposedRollResult) => {
    deps.setRolls(prev => mergeRoll(prev, roll))
    deps.triggerDiceOverlay(roll)
    deps.broadcast('roll', roll)
    const { error } = await insertRollRecord(roll, opposed)
    if (error) deps.setConnectionText('Встречная проверка отправлена онлайн, но не сохранилась')
    else deps.setConnectionText('Онлайн')
  }

  const publishRollReplacement = async (roll: RollMessage) => {
    deps.setRolls(prev => mergeRoll(prev, roll))
    deps.broadcast('roll', roll)
    const { error } = await updateRollRecord(roll.id, roll)

    if (error) deps.setConnectionText('Переброс отправлен онлайн, но не сохранился')
    else deps.setConnectionText('Онлайн')
  }

  const updateOpposedResponseSide = (patch: Partial<RollPoolBuilder>) => {
    deps.setOpposedResponseSide(current => ({ ...current, ...patch }))
  }

  const answerOpposedProposal = async () => {
    const proposal = deps.incomingOpposedProposal
    if (!proposal || !deps.chatUser || proposal.toUserId !== deps.chatUser.id) return
    if (!deps.selectedActiveCharacter) {
      window.alert(deps.t('Сначала выбери активного персонажа.'))
      return
    }

    const responsePool = getOpposedCharacterPool(
      opposedPoolContext,
      deps.selectedActiveCharacter,
      deps.opposedResponseSide,
    )
    if (responsePool.diceCount < 1) {
      window.alert(deps.t('Твой ответный пул должен быть хотя бы 1к10.'))
      return
    }

    const rightDice = rollsDice().rollD10Pool(responsePool.diceCount, getCharacterHunger(deps.selectedActiveCharacter)) as Die[]
    const rightSide: OpposedRollSide = {
      id: 'right',
      actorName: deps.selectedActiveCharacter.name || deps.t('Ответчик'),
      actorKind: 'player',
      poolName: responsePool.poolName,
      diceCount: rightDice.length,
      dice: rightDice,
      successes: rollsDice().countD10Successes(rightDice),
    }
    const leftSide = proposal.initiator
    const responseRollModifiers = responsePool.rollEffectResult?.modifiers.filter(modifier => (
      modifier.active
      && (
        modifier.diceDelta !== 0
        || modifier.difficultyDelta !== 0
        || modifier.operation === 'ignore_penalty'
        || modifier.operation === 'auto_success'
      )
    ))
    const { roll, opposed } = buildAnsweredOpposedRoll({
      room: deps.room,
      proposalId: proposal.id,
      leftSide,
      rightSide,
      opponentUserId: deps.chatUser.id,
      opponentCharacterId: deps.selectedActiveCharacter.id,
      responseRollModifiers,
      rollDifficultyModifier: responsePool.rollEffectResult?.difficultyDelta || undefined,
      warnings: getActiveRollModifierWarnings(responsePool.rollEffectResult),
      t: deps.t,
      tf: deps.tf,
    })

    deps.setIncomingOpposedProposal(null)
    deps.setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
    await publishOpposedRoll(roll, opposed)
  }

  const dismissOpposedProposal = () => {
    deps.setIncomingOpposedProposal(null)
    deps.setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
  }

  return {
    publishRoll,
    publishOpposedRoll,
    publishRollReplacement,
    updateOpposedResponseSide,
    answerOpposedProposal,
    dismissOpposedProposal,
  }
}