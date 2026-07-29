import type { MutableRefObject } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { ContestedOpponentOption, QuickRollOptions } from '@/games/vampires/modules/rolls/types'
import { createQuickRollFactory } from '@/games/vampires/modules/rolls/hooks'
import { getRollPenalties, getRollTraits } from '../utils/roll-pool-helpers'
import type { CharacterOption, OpposedRollProposal, RollMessage, RollMeta, RollMode } from '../types'

export type PoolRollSnapshot = {
  selectedMasterRollCharacter: CharacterOption | null
  masterRollDiceCount: number
  masterRollMode: RollMode
  selectedMasterContestedOpponent: ContestedOpponentOption | null
  masterRollPoolBeforeLimit: number
  masterRollPoolName: string
  masterRollHidden: boolean
  masterUseBloodSurge: boolean
  masterRollAttribute: string
  masterRollAttributeTwo: string
  masterRollSkill: string
  masterRollDiscipline: string
  masterWillpowerImpairmentPenalty: number
  masterHealthImpairmentPenalty: number
  disabledMasterRollModifierIds: string[]
  previewCharacter: CharacterOption | null
  canRollPreview: boolean
  previewDiceCount: number
  previewRollMode: RollMode
  selectedPreviewContestedOpponent: ContestedOpponentOption | null
  previewPoolBeforeLimit: number
  previewBloodSurgeEnabled: boolean
  previewRollAttribute: string
  previewRollAttributeTwo: string
  previewRollSkill: string
  previewRollDiscipline: string
  previewAttributeDots: number
  previewAttributeTwoDots: number
  previewSkillDots: number
  previewDisciplineDots: number
  previewRollModifier: number
  previewWillpowerImpairmentPenalty: number
  previewHealthImpairmentPenalty: number
  disabledPreviewRollModifierIds: string[]
}

export type PoolRollActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  d10: (count: number) => string
  chatUser: ChatUser | null
  isMaster: boolean
  setConnectionText: (text: string) => void
  broadcast: (event: string, payload: unknown) => void
  publishRollRef: MutableRefObject<(roll: RollMessage) => Promise<void>>
  rollQuickDiceRef: MutableRefObject<(
    diceCount?: number,
    poolName?: string,
    characterOverride?: CharacterOption,
    poolType?: string,
    options?: QuickRollOptions,
  ) => Promise<void>>
  createQuickRollRef: MutableRefObject<ReturnType<typeof createQuickRollFactory>>
  getPoolRollSnapshot: () => PoolRollSnapshot
}

export function createPoolRollActions(deps: PoolRollActionsDeps) {
  const sendContestedRollRequest = async (
    diceCount: number,
    poolName: string,
    character: CharacterOption,
    opponent: ContestedOpponentOption | null,
    poolType: string,
    options: QuickRollOptions = {},
  ) => {
    if (!deps.chatUser) {
      window.alert(deps.t('Сначала войди в чат стола.'))
      return
    }
    if (!opponent) {
      window.alert(deps.t('Выбери оппонента для встречного броска.'))
      return
    }
    if (opponent.actorKind === 'player' && (!opponent.userId || opponent.userId === deps.chatUser.id)) {
      window.alert(deps.t('Выбери другого игрока для встречного броска.'))
      return
    }

    const initiatorRoll = await deps.createQuickRollRef.current(diceCount, poolName, character, poolType, {
      ...options,
      hidden: false,
    })
    const requestId = initiatorRoll.id
    const contestedMeta: NonNullable<RollMeta['contested']> = {
      requestId,
      initiatorCharacterId: character.id,
      initiatorCharacterName: character.name,
      initiatorPoolName: poolName,
      initiatorDiceCount: initiatorRoll.diceCount,
      opponentUserId: opponent.userId,
      opponentCharacterId: opponent.characterId || undefined,
      opponentName: opponent.label,
      status: 'requested',
      initiatorSuccesses: initiatorRoll.successes,
    }
    const requestRoll: RollMessage = {
      id: `${requestId}-request`,
      room: deps.room,
      characterName: character.name,
      poolName: deps.tf('{left} против {right}', { left: character.name, right: opponent.label }),
      poolType: 'contested-request',
      diceCount: initiatorRoll.diceCount,
      dice: [],
      successes: 0,
      createdAt: initiatorRoll.createdAt,
      meta: {
        ...(initiatorRoll.meta || {}),
        rollMode: 'contested',
        contested: contestedMeta,
      },
    }

    await deps.publishRollRef.current(requestRoll)

    if (opponent.actorKind === 'player' && opponent.userId) {
      const proposal: OpposedRollProposal = {
        id: requestId,
        room: deps.room,
        fromUserId: deps.chatUser.id,
        fromUsername: deps.chatUser.username,
        toUserId: opponent.userId,
        createdAt: initiatorRoll.createdAt,
        initiator: {
          id: 'left',
          actorName: character.name,
          actorKind: deps.isMaster ? 'npc' : 'player',
          poolName,
          diceCount: initiatorRoll.diceCount,
          dice: initiatorRoll.dice,
          successes: initiatorRoll.successes,
        },
      }
      await deps.broadcast('opposed-roll-proposal', proposal)
    }

    deps.setConnectionText(`Встречный бросок запрошен: ${opponent.label}`)
  }

  const rollMasterPool = async () => {
    const snapshot = deps.getPoolRollSnapshot()
    if (!snapshot.selectedMasterRollCharacter) {
      window.alert(deps.t('Выбери персонажа мастера.'))
      return
    }
    if (snapshot.masterRollDiceCount < 1) {
      window.alert(deps.t('Выбери характеристику, навык, дисциплину или положительный модификатор.'))
      return
    }
    if (snapshot.masterRollMode === 'contested' && !snapshot.selectedMasterContestedOpponent) {
      window.alert(deps.t('Выбери оппонента для встречного броска.'))
      return
    }
    const options: QuickRollOptions = {
      hidden: snapshot.masterRollHidden,
      useBloodSurge: snapshot.masterUseBloodSurge,
      source: snapshot.masterUseBloodSurge ? 'blood_surge' : 'manual',
      rollTraits: getRollTraits(
        snapshot.masterRollAttribute,
        snapshot.masterRollAttributeTwo,
        snapshot.masterRollSkill,
        snapshot.masterRollDiscipline,
      ),
      rollAction: snapshot.masterRollMode,
      rollPenalties: getRollPenalties(
        deps.t,
        snapshot.masterWillpowerImpairmentPenalty,
        snapshot.masterHealthImpairmentPenalty,
      ),
      disabledRollModifierIds: snapshot.disabledMasterRollModifierIds,
    }
    if (snapshot.masterRollMode === 'contested') {
      await sendContestedRollRequest(
        snapshot.masterRollPoolBeforeLimit,
        snapshot.masterRollPoolName,
        snapshot.selectedMasterRollCharacter,
        snapshot.selectedMasterContestedOpponent,
        'master-character',
        options,
      )
      return
    }
    await deps.rollQuickDiceRef.current(
      snapshot.masterRollPoolBeforeLimit,
      snapshot.masterRollPoolName,
      snapshot.selectedMasterRollCharacter,
      'master-character',
      options,
    )
  }

  const rollMasterQuick = async (diceCount: number) => {
    const snapshot = deps.getPoolRollSnapshot()
    if (!snapshot.selectedMasterRollCharacter) {
      window.alert(deps.t('Выбери персонажа мастера.'))
      return
    }
    await deps.rollQuickDiceRef.current(
      diceCount,
      deps.d10(diceCount),
      snapshot.selectedMasterRollCharacter,
      'master-quick',
      {
        hidden: snapshot.masterRollHidden,
        useBloodSurge: snapshot.masterUseBloodSurge,
        source: snapshot.masterUseBloodSurge ? 'blood_surge' : 'manual',
      },
    )
  }

  const rollPreviewPool = async () => {
    const snapshot = deps.getPoolRollSnapshot()
    if (!snapshot.previewCharacter || !snapshot.canRollPreview) {
      window.alert(deps.t('Броски доступны мастеру или владельцу активного персонажа.'))
      return
    }
    if (snapshot.previewDiceCount < 1) {
      window.alert(deps.t('Выбери характеристику, навык или положительный модификатор.'))
      return
    }
    if (snapshot.previewRollMode === 'contested' && !snapshot.selectedPreviewContestedOpponent) {
      window.alert(deps.t('Выбери оппонента для встречного броска.'))
      return
    }

    const poolParts = []
    if (snapshot.previewRollAttribute) {
      poolParts.push(`${deps.t(snapshot.previewRollAttribute)} ${snapshot.previewAttributeDots}`)
    }
    if (snapshot.previewRollAttributeTwo) {
      poolParts.push(`${deps.t(snapshot.previewRollAttributeTwo)} ${snapshot.previewAttributeTwoDots}`)
    }
    if (snapshot.previewRollSkill) {
      poolParts.push(`${deps.t(snapshot.previewRollSkill)} ${snapshot.previewSkillDots}`)
    }
    if (snapshot.previewRollDiscipline) {
      poolParts.push(`${snapshot.previewRollDiscipline} ${snapshot.previewDisciplineDots}`)
    }
    if (snapshot.previewRollModifier) {
      poolParts.push(`${deps.t('модификатор')} ${snapshot.previewRollModifier > 0 ? '+' : ''}${snapshot.previewRollModifier}`)
    }
    const poolName = poolParts.join(' + ') || deps.d10(snapshot.previewDiceCount)
    const options: QuickRollOptions = {
      useBloodSurge: snapshot.previewBloodSurgeEnabled,
      source: snapshot.previewBloodSurgeEnabled ? 'blood_surge' : 'manual',
      rollTraits: getRollTraits(
        snapshot.previewRollAttribute,
        snapshot.previewRollAttributeTwo,
        snapshot.previewRollSkill,
        snapshot.previewRollDiscipline,
      ),
      rollAction: snapshot.previewRollMode,
      rollPenalties: getRollPenalties(
        deps.t,
        snapshot.previewWillpowerImpairmentPenalty,
        snapshot.previewHealthImpairmentPenalty,
      ),
      disabledRollModifierIds: snapshot.disabledPreviewRollModifierIds,
    }
    if (snapshot.previewRollMode === 'contested') {
      await sendContestedRollRequest(
        snapshot.previewPoolBeforeLimit,
        poolName,
        snapshot.previewCharacter,
        snapshot.selectedPreviewContestedOpponent,
        'character-sheet',
        options,
      )
      return
    }
    await deps.rollQuickDiceRef.current(
      snapshot.previewPoolBeforeLimit,
      poolName,
      snapshot.previewCharacter,
      'character-sheet',
      options,
    )
  }

  return {
    sendContestedRollRequest,
    rollMasterPool,
    rollMasterQuick,
    rollPreviewPool,
  }
}