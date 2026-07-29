import { createClient } from '@/games/vampires/lib/supabase'
import { appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import { setActorHunger, readActorHunger } from '@/games/vampires/modules/actors/services/actor-actions'
import type { MasterActor } from '@/games/vampires/modules/actors/types'
import {
  buildOpposedRollResult,
  buildQuickRoll,
  buildRouseCheckRoll,
  getBloodSurgeBonus,
  getRouseWarning,
  applyWillpowerRerollToDice,
} from '@/games/vampires/modules/rolls'
import { rollsDice } from '@/games/vampires/modules/rolls/system-runtime'
import type { QuickRollOptions } from '@/games/vampires/modules/rolls/types'
import { insertRollRecord, updateRollRecord, fetchRollHistory } from '@/games/vampires/modules/table/api/roll-api'
import { tableApplyDisciplineEffectsToRoll } from '@/games/vampires/modules/table/system-runtime'
import {
  getCharacterBloodPotency,
  getCharacterHealth,
  getCharacterHunger,
  getCharacterWillpower,
  getWillpowerMetaState,
} from '@/games/vampires/modules/table/utils/character-state'
import { getAttributeDots, resolveSkillValue } from '@/games/vampires/lib/i18n/ruleNames'
import { getDisciplineDots, getSkillDots } from '@/games/vampires/modules/table/components/character-preview-helpers'
import { getRollDieId } from '@/games/vampires/modules/table/utils/roll-utils'
import { getRollTraits, getRollPenalties } from '@/games/vampires/modules/table/utils/roll-pool-helpers'
import type {
  CharacterOption,
  Die,
  OpposedRollSide,
  RollMessage,
  RouseCheckResult,
} from '@/games/vampires/modules/table/types'
import {
  deleteHiddenRoll,
  fetchHiddenRolls,
  insertHiddenRoll,
  loadHiddenRollById,
  markHiddenRollRevealed,
} from '../api'
import type {
  MasterInverseOperation,
  MasterRollBuilderState,
  MasterRollConsequence,
  MasterRollConsequenceAction,
  MasterRollPoolPreview,
  PublishMasterRollResult,
} from '../types'
import { actorToRollCharacter, resolveActorIdFromRollCharacterId } from './actor-roll-character'

function identityT(ru: string) {
  return ru
}

function identityTf(ru: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    ru,
  )
}

function traitDots(character: CharacterOption, name: string, kind: 'attr' | 'skill' | 'discipline') {
  if (!name) return 0
  if (kind === 'attr') return getAttributeDots(character.attributes, name)
  if (kind === 'skill') return getSkillDots(resolveSkillValue(character.skills, name))
  const raw = character.disciplines[name]
  if (typeof raw === 'number') return Math.max(0, raw)
  if (raw && typeof raw === 'object') {
    return getDisciplineDots(raw as Record<string, number>)
  }
  return 0
}

export function buildPoolPreview(
  character: CharacterOption,
  state: MasterRollBuilderState,
): MasterRollPoolPreview {
  const attr = traitDots(character, state.attribute, 'attr')
  const attr2 = traitDots(character, state.attributeTwo, 'attr')
  const skill = traitDots(character, state.skill, 'skill')
  const discipline = traitDots(character, state.discipline, 'discipline')
  const base = attr + attr2 + skill + discipline + state.modifier
  const bloodSurgeBonus = state.useBloodSurge ? getBloodSurgeBonus(getCharacterBloodPotency(character)) : 0
  const dice = Math.max(0, Math.min(20, base + bloodSurgeBonus))
  const hunger = getCharacterHunger(character)
  const hungerDice = Math.min(hunger, Math.max(1, dice || 1))
  const traits = getRollTraits(state.attribute, state.attributeTwo, state.skill, state.discipline)
  const parts: string[] = []
  if (state.attribute) parts.push(`${state.attribute} ${attr}`)
  if (state.attributeTwo) parts.push(`${state.attributeTwo} ${attr2}`)
  if (state.skill) parts.push(`${state.skill} ${skill}`)
  if (state.discipline) parts.push(`${state.discipline} ${discipline}`)
  if (state.modifier) parts.push(`мод ${state.modifier > 0 ? '+' : ''}${state.modifier}`)
  const warnings: string[] = []
  if (hunger >= 4) warnings.push(`Голод ${hunger}: высокий риск звериных результатов`)
  if (state.useBloodSurge) warnings.push(`Прилив Крови: +${bloodSurgeBonus}к и Rouse`)
  return {
    dice: Math.max(1, dice || 1),
    normalDice: Math.max(0, Math.max(1, dice || 1) - hungerDice),
    hungerDice,
    poolName: parts.join(' + ') || `${Math.max(1, dice || 1)}к`,
    traits,
    bloodSurgeBonus,
    hunger,
    warnings,
  }
}

async function performMasterRouseCheck(
  actor: MasterActor | null,
  character: CharacterOption,
  reason: string,
  hungerBefore?: number,
): Promise<RouseCheckResult> {
  const safeBefore = Math.max(0, Math.min(5, Math.floor(Number(hungerBefore ?? getCharacterHunger(character)) || 0)))
  const value = Math.floor(Math.random() * 10) + 1
  const success = value >= 6
  const hungerAfter = success ? safeBefore : Math.max(0, Math.min(5, safeBefore + 1))
  const result: RouseCheckResult = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    reason,
    value,
    success,
    hungerBefore: safeBefore,
    hungerAfter,
    maxHungerWarning: !success && safeBefore >= 5,
  }
  if (actor && hungerAfter !== safeBefore) {
    try {
      await setActorHunger(actor, hungerAfter)
    } catch (error) {
      console.warn('Failed to persist actor hunger after rouse', error)
    }
  }
  return result
}

function createBuildDeps(room: string, actor: MasterActor | null) {
  return {
    room,
    isMaster: true,
    disciplineRules: null as Record<string, unknown> | null,
    rollsDice: rollsDice(),
    applyDisciplineEffectsToRoll: tableApplyDisciplineEffectsToRoll,
    performRouseCheck: (character: CharacterOption, reason: string, hungerBefore?: number) =>
      performMasterRouseCheck(actor, character, reason, hungerBefore),
    getCharacterHunger,
    getCharacterWillpower,
    getCharacterBloodPotency,
    getCharacterHealth,
    getWillpowerMetaState,
  }
}

async function logRollAction(input: {
  chronicleId: string
  room: string
  roll: RollMessage
  actorId: string | null
  summary: string
  inverse: MasterInverseOperation | null
  visibility: 'master' | 'shared'
}) {
  try {
    await appendMasterActionLog({
      chronicleId: input.chronicleId,
      room: input.room,
      sessionId: null,
      actionType: input.roll.hidden ? 'master_rolls.hidden_roll' : 'master_rolls.public_roll',
      actorType: 'master',
      actorId: input.actorId || 'self',
      summary: input.summary,
      payload: {
        rollId: input.roll.id,
        hidden: Boolean(input.roll.hidden),
        poolName: input.roll.poolName,
        characterName: input.roll.characterName,
        successes: input.roll.successes,
      },
      inversePayload: input.inverse,
      visibility: input.visibility,
    })
  } catch (error) {
    console.warn('master action log append failed', error)
  }
}

export async function publishMasterRoll(
  roll: RollMessage,
  context: { chronicleId: string; room: string; actorId: string | null },
): Promise<PublishMasterRollResult> {
  if (roll.hidden) {
    try {
      await insertHiddenRoll(context.chronicleId, context.room, roll)
      await logRollAction({
        chronicleId: context.chronicleId,
        room: context.room,
        roll,
        actorId: context.actorId,
        summary: `Скрытый бросок: ${roll.characterName} · ${roll.poolName}`,
        inverse: { type: 'delete_hidden_roll', rollId: roll.id },
        visibility: 'master',
      })
      return { roll, storage: 'hidden' }
    } catch (error) {
      // Auth/schema may be undeployed — keep master-local only, never leak to table_rolls.
      console.warn('hidden roll persistence failed; keeping local master-only', error)
      await logRollAction({
        chronicleId: context.chronicleId,
        room: context.room,
        roll,
        actorId: context.actorId,
        summary: `Скрытый бросок (локально): ${roll.characterName} · ${roll.poolName}`,
        inverse: { type: 'noop' },
        visibility: 'master',
      }).catch(() => undefined)
      return { roll, storage: 'local' }
    }
  }

  const { error } = await insertRollRecord(roll)
  if (error) throw error
  // Same broadcast event /table listens to — never used for hidden rolls.
  try {
    const client = createClient()
    const channel = client.channel(`table-room:${context.room}`)
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => resolve(), 1200)
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout)
          resolve()
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout)
          reject(new Error(status))
        }
      })
    })
    await channel.send({ type: 'broadcast', event: 'roll', payload: roll })
    void client.removeChannel(channel)
  } catch (broadcastError) {
    console.warn('public roll broadcast failed; row is still in table_rolls', broadcastError)
  }
  await logRollAction({
    chronicleId: context.chronicleId,
    room: context.room,
    roll,
    actorId: context.actorId,
    summary: `Бросок: ${roll.characterName} · ${roll.poolName}`,
    inverse: null,
    visibility: 'shared',
  })
  return { roll, storage: 'public' }
}

export async function revealHiddenRoll(
  rollId: string,
  context: { chronicleId: string; room: string },
): Promise<RollMessage> {
  const hidden = await loadHiddenRollById(rollId)
  if (!hidden) throw new Error('Скрытый бросок не найден')
  const publicRoll: RollMessage = {
    ...hidden,
    id: `${hidden.id}-revealed`,
    hidden: false,
    meta: {
      ...(hidden.meta || {}),
      warnings: [...(hidden.meta?.warnings || []), 'Раскрыт рассказчиком'],
    },
  }
  const { error } = await insertRollRecord(publicRoll)
  if (error) throw error
  await markHiddenRollRevealed(rollId, publicRoll.id)
  try {
    await appendMasterActionLog({
      chronicleId: context.chronicleId,
      room: context.room,
      sessionId: null,
      actionType: 'master_rolls.reveal',
      actorType: 'master',
      actorId: 'self',
      summary: `Раскрыт бросок: ${publicRoll.characterName} · ${publicRoll.poolName}`,
      payload: { hiddenRollId: rollId, publicRollId: publicRoll.id },
      inversePayload: null,
      visibility: 'master',
    })
  } catch {
    // ignore log failures
  }
  return publicRoll
}

export async function rollMasterPool(input: {
  room: string
  chronicleId: string
  actor: MasterActor
  opponent?: MasterActor | null
  state: MasterRollBuilderState
}): Promise<PublishMasterRollResult> {
  const character = actorToRollCharacter(input.actor)
  const preview = buildPoolPreview(character, input.state)
  if (preview.dice < 1) throw new Error('Пул должен быть хотя бы 1к')

  const options: QuickRollOptions = {
    hidden: input.state.hidden,
    useBloodSurge: input.state.useBloodSurge && ['vampire', 'thinblood'].includes(character.characterType),
    source: input.state.useBloodSurge ? 'blood_surge' : 'manual',
    rollTraits: preview.traits,
    rollAction: input.state.mode,
    rollPenalties: getRollPenalties(identityT, 0, 0),
  }

  const deps = createBuildDeps(input.room, input.actor)

  if (input.state.mode === 'contested' && input.opponent) {
    const leftRoll = await buildQuickRoll(
      deps,
      preview.dice,
      preview.poolName,
      character,
      'master-character',
      { ...options, hidden: input.state.hidden },
    )
    const opponentCharacter = actorToRollCharacter(input.opponent)
    const rightPreview = buildPoolPreview(opponentCharacter, {
      ...input.state,
      actorId: input.opponent.id,
      useBloodSurge: false,
      hidden: input.state.hidden,
    })
    const rightRoll = await buildQuickRoll(
      createBuildDeps(input.room, input.opponent),
      rightPreview.dice,
      rightPreview.poolName,
      opponentCharacter,
      'master-character',
      { hidden: input.state.hidden, source: 'manual' },
    )
    const leftSide: OpposedRollSide = {
      id: 'left',
      actorName: character.name,
      actorKind: 'npc',
      poolName: preview.poolName,
      diceCount: leftRoll.diceCount,
      dice: leftRoll.dice,
      successes: leftRoll.successes,
    }
    const rightSide: OpposedRollSide = {
      id: 'right',
      actorName: opponentCharacter.name,
      actorKind: 'npc',
      poolName: rightPreview.poolName,
      diceCount: rightRoll.diceCount,
      dice: rightRoll.dice,
      successes: rightRoll.successes,
    }
    const opposed = buildOpposedRollResult(leftSide, rightSide, identityT, identityTf)
    const roll: RollMessage = {
      id: leftRoll.id,
      room: input.room,
      characterName: 'Встречная проверка',
      poolName: `${character.name} против ${opponentCharacter.name}`,
      poolType: 'opposed',
      diceCount: leftSide.diceCount + rightSide.diceCount,
      dice: [],
      successes: Math.max(leftSide.successes, rightSide.successes),
      createdAt: new Date().toISOString(),
      hidden: input.state.hidden || undefined,
      opposed,
      meta: {
        rollMode: 'contested',
        characterId: character.id,
        contested: {
          requestId: leftRoll.id,
          initiatorCharacterId: character.id,
          initiatorCharacterName: character.name,
          initiatorPoolName: preview.poolName,
          initiatorDiceCount: leftSide.diceCount,
          opponentCharacterId: opponentCharacter.id,
          opponentName: opponentCharacter.name,
          status: 'resolved',
          initiatorSuccesses: leftSide.successes,
          opponentSuccesses: rightSide.successes,
          margin: Math.abs(leftSide.successes - rightSide.successes),
          winner: opposed.winnerSideId === 'left'
            ? 'initiator'
            : opposed.winnerSideId === 'right'
              ? 'opponent'
              : 'tie',
        },
        hungerBefore: leftRoll.meta?.hungerBefore,
        hungerAfter: leftRoll.meta?.hungerAfter,
        warnings: leftRoll.meta?.warnings,
      },
    }
    return publishMasterRoll(roll, {
      chronicleId: input.chronicleId,
      room: input.room,
      actorId: input.actor.id,
    })
  }

  const roll = await buildQuickRoll(
    deps,
    preview.dice,
    input.state.difficulty > 0
      ? `${preview.poolName} · сл. ${input.state.difficulty}`
      : preview.poolName,
    character,
    'master-character',
    options,
  )
  if (input.state.difficulty > 0) {
    const margin = roll.successes - input.state.difficulty
    roll.meta = {
      ...(roll.meta || {}),
      rollDifficultyModifier: input.state.difficulty,
      warnings: [
        ...(roll.meta?.warnings || []),
        margin >= 0
          ? `Успех против сложности ${input.state.difficulty} (маржа ${margin})`
          : `Провал против сложности ${input.state.difficulty} (нужно ещё ${-margin})`,
      ],
    }
  }
  return publishMasterRoll(roll, {
    chronicleId: input.chronicleId,
    room: input.room,
    actorId: input.actor.id,
  })
}

export async function rollMasterRouse(input: {
  room: string
  chronicleId: string
  actor: MasterActor
  hidden: boolean
  reason?: string
}): Promise<PublishMasterRollResult> {
  const character = actorToRollCharacter(input.actor)
  const result = await performMasterRouseCheck(
    input.actor,
    character,
    input.reason || 'Испытание Крови / Проверка Голода',
  )
  const roll = buildRouseCheckRoll(
    character,
    input.room,
    result,
    result.reason,
    rollsDice(),
    getCharacterBloodPotency,
  )
  roll.hidden = input.hidden || undefined
  const hungerBefore = result.hungerBefore
  return publishMasterRoll(roll, {
    chronicleId: input.chronicleId,
    room: input.room,
    actorId: input.actor.id,
  }).then(async published => {
    if (result.hungerAfter !== hungerBefore) {
      // Inverse for failed rouse hunger bump is already covered if we log it.
    }
    return published
  })
}

export async function rollMasterFrenzy(input: {
  room: string
  chronicleId: string
  actor: MasterActor
  hidden: boolean
  difficulty?: number
}): Promise<PublishMasterRollResult> {
  const character = actorToRollCharacter(input.actor)
  const resolve = getAttributeDots(character.attributes, 'Упорство')
  const composure = getAttributeDots(character.attributes, 'Самообладание')
  const dice = Math.max(1, resolve + composure)
  const difficulty = input.difficulty ?? 3
  const roll = await buildQuickRoll(
    createBuildDeps(input.room, input.actor),
    dice,
    `Френзи · Упорство+Самообладание · сл. ${difficulty}`,
    character,
    'frenzy-check',
    {
      hidden: input.hidden,
      skipHungerDice: false,
      source: 'manual',
      rollTraits: ['Упорство', 'Самообладание'],
      rollAction: 'frenzy',
      rollKind: 'roll',
    },
  )
  const margin = roll.successes - difficulty
  roll.meta = {
    ...(roll.meta || {}),
    rollDifficultyModifier: difficulty,
    warnings: [
      ...(roll.meta?.warnings || []),
      margin >= 0
        ? `Френзи сдержан (маржа ${margin})`
        : `Френзи: провал против сложности ${difficulty}`,
    ],
  }
  return publishMasterRoll(roll, {
    chronicleId: input.chronicleId,
    room: input.room,
    actorId: input.actor.id,
  })
}

export function listConsequences(
  roll: RollMessage,
  actors: readonly MasterActor[],
): MasterRollConsequenceAction[] {
  const actions: MasterRollConsequenceAction[] = []
  const actorId = resolveActorIdFromRollCharacterId(roll.meta?.characterId, actors)
    || actors.find(actor => actor.name === roll.characterName)?.id
    || null
  const difficulty = Number(roll.meta?.rollDifficultyModifier) || 0
  const failedVsDifficulty = difficulty > 0 && roll.successes < difficulty
  const criticalSuccess = roll.successes >= 5 && !roll.meta?.messyCritical

  if (roll.meta?.bestialFailure) {
    actions.push({
      id: `${roll.id}:bestial`,
      consequence: 'bestial_failure',
      label: actorId ? `Звериный провал: бросить френзи` : 'Звериный провал: френзи',
      rollId: roll.id,
      actorId,
    })
  }
  if (roll.meta?.messyCritical) {
    actions.push({
      id: `${roll.id}:messy`,
      consequence: 'messy_critical',
      label: 'Грязный крит: отметить последствие',
      rollId: roll.id,
      actorId,
    })
  }
  if (failedVsDifficulty || (difficulty === 0 && roll.successes === 0 && !roll.meta?.bestialFailure)) {
    actions.push({
      id: `${roll.id}:fail`,
      consequence: 'failure',
      label: 'Провал',
      rollId: roll.id,
      actorId,
    })
  }
  if (criticalSuccess) {
    actions.push({
      id: `${roll.id}:crit`,
      consequence: 'critical_success',
      label: 'Критический успех',
      rollId: roll.id,
      actorId,
    })
  }
  if (roll.meta?.rouseChecks?.some(check => check.maxHungerWarning)) {
    actions.push({
      id: `${roll.id}:max-hunger`,
      consequence: 'max_hunger',
      label: 'Макс. Голод: реакция рассказчика',
      rollId: roll.id,
      actorId,
    })
  }
  if (roll.poolType === 'rouse-check' && roll.successes === 0) {
    actions.push({
      id: `${roll.id}:failed-rouse`,
      consequence: 'failed_rouse',
      label: 'Неудачный Rouse: +Голод',
      rollId: roll.id,
      actorId,
    })
  }
  return actions
}

export async function applyWillpowerReroll(
  roll: RollMessage,
  selectedDieIds: string[],
): Promise<RollMessage> {
  const { rerolledDice, oldDice, newDice, successes, outcomeMeta } = applyWillpowerRerollToDice(
    roll,
    selectedDieIds,
    rollsDice(),
    getRollDieId,
  )
  const next: RollMessage = {
    ...roll,
    dice: rerolledDice as Die[],
    successes,
    meta: {
      ...(roll.meta || {}),
      ...outcomeMeta,
      willpowerReroll: {
        used: true,
        selectedDieIds,
        oldDice,
        newDice,
      },
    },
  }
  if (!roll.hidden) {
    const { error } = await updateRollRecord(roll.id, next)
    if (error) throw error
  }
  return next
}

export async function loadMasterRollHistory(room: string): Promise<{
  publicRolls: RollMessage[]
  hiddenRolls: RollMessage[]
}> {
  const [{ rolls: publicRolls, error }, hiddenRolls] = await Promise.all([
    fetchRollHistory(room),
    fetchHiddenRolls(room).catch(() => [] as RollMessage[]),
  ])
  if (error) {
    console.warn('public roll history load failed', error)
  }
  return {
    publicRolls: publicRolls || [],
    hiddenRolls,
  }
}

export async function executeInverseOperation(
  inverse: MasterInverseOperation,
  actors: readonly MasterActor[],
): Promise<void> {
  if (inverse.type === 'noop') return
  if (inverse.type === 'delete_hidden_roll') {
    await deleteHiddenRoll(inverse.rollId).catch(() => undefined)
    return
  }
  if (inverse.type === 'restore_actor_hunger') {
    const actor = actors.find(item => item.id === inverse.actorId)
    if (!actor) throw new Error('Актор для undo не найден')
    await setActorHunger(actor, inverse.hunger)
  }
}

export { readActorHunger, getRouseWarning }
