import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { getAttributeDots } from '@/games/vampires/lib/i18n/ruleNames'
import type { DamageSeverity, HealthDamageOptions } from '@/games/vampires/core/vtm5/rules/health'
import type { HumanityState, HumanityStainSource } from '@/games/vampires/core/vtm5/rules/humanity'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { QuickRollOptions } from '@/games/vampires/modules/rolls/types'
import {
  buildRemorseCheckRoll,
  buildRouseCheckRoll,
  computeRemorseCheckOutcome,
  getRouseWarning,
} from '@/games/vampires/modules/rolls/utils'
import { rollsDice } from '@/games/vampires/modules/rolls/system-runtime'
import { fetchCharacterById, updateCharacterData } from '../api/character-api'
import {
  getCharacterBloodPotency,
  getCharacterDamageProfile,
  getCharacterHealth,
  getCharacterHealthStamina,
  getCharacterHunger,
  getCharacterWillpower,
  getWillpowerMetaState,
  applyWillpowerStressValue,
  recoverWillpowerStressValue,
} from '../utils/character-state'
import type { DisciplineRule } from '../utils/discipline-ui'
import {
  getCharacterType,
  getDefaultDamageProfile,
  mapCharacterRow,
  normalizeWillpowerTracker,
} from '../mappers'
import { tableDisciplines, tableHealth, tableHumanity } from '../system-runtime'
import type {
  ActiveParticipant,
  CharacterOption,
  CharacterRow,
  NormalizedHealth,
  NormalizedWillpower,
  RollMessage,
  RollMeta,
  RouseCheckResult,
} from '../types'

export type CharacterActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  disciplineRules: Record<string, DisciplineRule> | null
  defaultDisciplineRules: Record<string, DisciplineRule>
  chatUser: ChatUser | null
  selectedActiveCharacterId: string | null
  setChatCharacters: Dispatch<SetStateAction<CharacterOption[]>>
  setPreviewCharacter: Dispatch<SetStateAction<CharacterOption | null>>
  setConnectionText: (text: string) => void
  broadcast: (event: string, payload: unknown) => void
  getChatCharacters: () => CharacterOption[]
  publishRollRef: MutableRefObject<(roll: RollMessage) => Promise<void>>
  rollQuickDiceRef: MutableRefObject<(
    diceCount?: number,
    poolName?: string,
    characterOverride?: CharacterOption,
    poolType?: string,
    options?: QuickRollOptions,
  ) => Promise<void>>
}

function syncCharacterInState(
  deps: CharacterActionsDeps,
  characterId: string,
  updatedCharacter: CharacterOption,
) {
  deps.setChatCharacters(current => current.map(character => (
    character.id === characterId ? { ...updatedCharacter, username: character.username } : character
  )))
  deps.setPreviewCharacter(current => (
    current?.id === characterId ? { ...updatedCharacter, username: current.username } : current
  ))
}

export function createCharacterActions(deps: CharacterActionsDeps) {
  const publishRoll = (roll: RollMessage) => deps.publishRollRef.current(roll)

  const updateCharacterHunger = async (characterId: string, nextHunger: number, reason = 'Голод обновлён') => {
    const safeHunger = Math.max(0, Math.min(5, Math.floor(Number(nextHunger) || 0)))
    const { row: data, error } = await fetchCharacterById(characterId)

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Голода:', error)
      deps.setConnectionText('Голод не сохранился')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const nextData = {
      ...characterData,
      bloodPotency: Number(characterData.bloodPotency ?? characterData.blood?.potency ?? 0) || 0,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        hunger: safeHunger,
      },
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(characterId, nextData)

    if (updateError) {
      console.error('Не удалось сохранить Голод персонажа:', updateError)
      deps.setConnectionText('Голод не сохранился')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncCharacterInState(deps, characterId, updatedCharacter)

    if (deps.chatUser && deps.selectedActiveCharacterId === characterId) {
      const participant: ActiveParticipant = {
        userId: deps.chatUser.id,
        username: deps.chatUser.username,
        characterId,
        characterName: updatedCharacter.name || 'без персонажа',
        characterClan: updatedCharacter.clan || null,
        characterImage: updatedCharacter.image || '',
        updatedAt: new Date().toISOString(),
      }
      deps.broadcast('active-character', { room: deps.room, participant })
    }

    deps.setConnectionText(reason)
    return updatedCharacter
  }

  const updateCharacterHumanity = async (
    characterId: string,
    nextHumanity: HumanityState,
    reason = 'Человечность сохранена',
  ) => {
    const { row: data, error } = await fetchCharacterById(characterId)

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Человечности:', error)
      deps.setConnectionText('Человечность не сохранилась')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const normalized = tableHumanity().getHumanityState({ humanity: nextHumanity })
    const previousHumanity = characterData.humanity && typeof characterData.humanity === 'object'
      ? characterData.humanity
      : {}
    const nextData: NonNullable<CharacterRow['data']> = {
      ...characterData,
      humanity: {
        ...previousHumanity,
        ...normalized,
      },
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        humanity: normalized.value,
      },
      status: {
        ...(characterData.status || {}),
        humanityState: normalized.value <= 0 ? 'lost_to_beast' : undefined,
      },
    }

    const { error: updateError } = await updateCharacterData(characterId, {
      ...nextData,
      timestamp: new Date().toISOString(),
    })

    if (updateError) {
      console.error('Не удалось сохранить Человечность персонажа:', updateError)
      deps.setConnectionText('Человечность не сохранилась')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncCharacterInState(deps, characterId, updatedCharacter)
    deps.setConnectionText(reason)
    return updatedCharacter
  }

  const updateCharacterWillpower = async (
    characterId: string,
    nextTracker: { superficial: number; aggravated: number },
    reason = 'Воля обновлена',
  ) => {
    const { row: data, error } = await fetchCharacterById(characterId)

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Воли:', error)
      deps.setConnectionText('Воля не сохранилась')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const willpowerMax = mapCharacterRow(data as CharacterRow)
      .derivedStats.willpower.totalMax
    const normalized = normalizeWillpowerTracker(nextTracker, willpowerMax)
    const nextData = {
      ...characterData,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        willpower: {
          superficial: normalized.superficial,
          aggravated: normalized.aggravated,
        },
      },
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(characterId, nextData)

    if (updateError) {
      console.error('Не удалось сохранить Волю персонажа:', updateError)
      deps.setConnectionText('Воля не сохранилась')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncCharacterInState(deps, characterId, updatedCharacter)
    deps.setConnectionText(reason)
    return updatedCharacter
  }

  const syncHealthCharacter = (characterId: string, updatedCharacter: CharacterOption) => {
    syncCharacterInState(deps, characterId, updatedCharacter)
  }

  const updateCharacterHealth = async (
    characterId: string,
    nextTracker: NormalizedHealth,
    reason = 'Здоровье сохранено',
    options: { lastAggravatedMendAt?: string } = {},
  ) => {
    const { row: data, error } = await fetchCharacterById(characterId)

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Здоровья:', error)
      deps.setConnectionText('Здоровье не сохранилось')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const characterType = getCharacterType(characterData)
    const profile = tableHealth().normalizeDamageProfile(
      characterData.damageProfile || getDefaultDamageProfile(characterType),
    )
    const stamina = getAttributeDots(characterData.attributes, 'Выносливость')
      + mapCharacterRow(data as CharacterRow).derivedStats.health.passiveBonus
    const normalized = tableHealth().normalizeHealthTracker(
      tableHealth().toHealthTracker(nextTracker),
      stamina,
      profile,
    )
    const nextData = {
      ...characterData,
      characterType,
      damageProfile: profile,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        health: tableHealth().toHealthTracker(normalized),
      },
      status: {
        ...(characterData.status || {}),
        physicalState: normalized.physicalState,
      },
      healthState: {
        ...(characterData.healthState || {}),
        ...(options.lastAggravatedMendAt ? { lastAggravatedMendAt: options.lastAggravatedMendAt } : {}),
      },
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(characterId, nextData)

    if (updateError) {
      console.error('Не удалось сохранить Здоровье персонажа:', updateError)
      deps.setConnectionText('Здоровье не сохранилось')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncHealthCharacter(characterId, updatedCharacter)
    deps.setConnectionText(reason)
    return updatedCharacter
  }

  const publishHealthEvent = async (
    character: CharacterOption,
    reason: string,
    before: NormalizedHealth,
    after: NormalizedHealth,
    meta: Partial<RollMeta> = {},
  ) => {
    await publishRoll({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: deps.room,
      characterName: character.name,
      poolName: reason,
      poolType: 'health',
      diceCount: 0,
      dice: [],
      successes: 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'health',
        characterId: character.id,
        healthBefore: tableHealth().getHealthMetaState(before),
        healthAfter: tableHealth().getHealthMetaState(after),
        healthImpaired: after.impaired,
        physicalState: after.physicalState,
        ...meta,
      },
    })
  }

  const publishWillpowerEvent = async (
    character: CharacterOption,
    reason: string,
    before: NormalizedWillpower,
    after: NormalizedWillpower,
    meta: Partial<RollMeta> = {},
  ) => {
    await publishRoll({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: deps.room,
      characterName: character.name,
      poolName: reason,
      poolType: 'willpower',
      diceCount: 0,
      dice: [],
      successes: 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'willpower',
        characterId: character.id,
        willpowerBefore: getWillpowerMetaState(before),
        willpowerAfter: getWillpowerMetaState(after),
        willpowerImpaired: after.impaired,
        ...meta,
      },
    })
  }

  const performRouseCheck = async (
    character: CharacterOption,
    reason: string,
    hungerBefore = getCharacterHunger(character),
  ): Promise<RouseCheckResult> => {
    const safeBefore = Math.max(0, Math.min(5, Math.floor(Number(hungerBefore) || 0)))
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

    if (hungerAfter !== safeBefore) {
      await updateCharacterHunger(character.id, hungerAfter, 'Голод сохранён')
    }

    return result
  }

  const applyCharacterHealthDamage = async (
    character: CharacterOption,
    amount: number,
    severity: DamageSeverity,
    options: HealthDamageOptions = {},
  ) => {
    const before = getCharacterHealth(character)
    const profile = getCharacterDamageProfile(character)
    const damageEffectResult = tableDisciplines().applyDisciplineEffectsToDamage({
      targetCharacterData: character,
      sourceCharacterData: options.sourceCharacterData,
      rulesJson: deps.disciplineRules || deps.defaultDisciplineRules,
      baseAmount: amount,
      severity,
      target: 'health',
      source: options.source,
      attackType: options.attackType || options.source,
      attackTypes: [options.attackType, options.source].filter((value): value is string => typeof value === 'string'),
      weaponTags: options.weaponTags,
      creatureType: character.characterType,
      armor: options.armor,
      halveSuperficial: severity === 'superficial'
        && options.halveSuperficial !== false
        && !options.ignoreHalving,
    }, character.derivedStats)
    const result = tableHealth().applyHealthDamage(
      before,
      damageEffectResult.finalAmount,
      damageEffectResult.severity,
      { ...options, halveSuperficial: false, ignoreHalving: true },
      profile,
      deps.t,
      deps.tf,
    )
    const updatedCharacter = await updateCharacterHealth(character.id, result.tracker, 'Здоровье сохранено')
    if (!updatedCharacter) return null
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, 'Урон здоровью', before, after, {
      damage: {
        source: options.source || 'manual',
        originalAmount: damageEffectResult.originalAmount,
        finalAmount: damageEffectResult.finalAmount,
        severity: damageEffectResult.severity,
        halved: damageEffectResult.halved,
        amountBeforeHalving: damageEffectResult.amountBeforeHalving,
        originalSeverity: damageEffectResult.originalSeverity,
        prevented: damageEffectResult.prevented,
        armorIgnored: damageEffectResult.armorIgnored,
        armorValue: damageEffectResult.armorValue,
        modifiers: damageEffectResult.modifiers.filter(modifier => modifier.active),
        chain: damageEffectResult.chain,
        weaponModifier: options.weaponModifier,
        margin: options.margin,
        targetCharacterId: updatedCharacter.id,
        targetCharacterName: updatedCharacter.name,
      },
      warnings: result.warnings,
    })
    return { character: updatedCharacter, before, after, ...result }
  }

  const recoverCharacterHealth = async (
    character: CharacterOption,
    amount: number,
    severity: DamageSeverity,
    reason: string,
    healingType: NonNullable<RollMeta['healing']>['type'] = 'manual',
  ) => {
    const before = getCharacterHealth(character)
    const result = tableHealth().recoverHealthDamage(before, amount, severity, getCharacterDamageProfile(character))
    if (result.recovered < 1) return null
    const updatedCharacter = await updateCharacterHealth(character.id, result.tracker, 'Здоровье сохранено')
    if (!updatedCharacter) return null
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, reason, before, after, {
      healing: {
        type: healingType,
        amountSuperficial: severity === 'superficial' ? result.recovered : 0,
        amountAggravated: severity === 'aggravated' ? result.recovered : 0,
      },
    })
    return updatedCharacter
  }

  const addHumanityStains = async (
    character: CharacterOption,
    amount: number,
    reason = 'ручное решение',
    options: { source?: HumanityStainSource; reasonText?: string } = {},
  ) => {
    const result = tableHumanity().addHumanityStains(
      { humanity: character.humanity || { value: 7, stains: 0 } },
      amount,
      reason,
      { source: options.source || 'manual', reasonText: options.reasonText },
    )
    const updated = await updateCharacterHumanity(character.id, result.humanity, 'Сомнения сохранены')
    if (!updated) return null

    const state = updated.humanity || {
      ...result.humanity,
      freeBoxes: Math.max(0, 10 - result.humanity.value - result.humanity.stains),
      status: tableHumanity().getHumanityStatus(result.humanity),
    }
    await publishRoll({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: deps.room,
      characterName: character.name,
      poolName: deps.tf('{name} получает {applied} Сомнение: {sourceText}. Человечность: {value}, Сомнения: {stains}/{remaining}.', {
        name: character.name,
        applied: result.applied,
        sourceText: options.reasonText || deps.t(reason),
        value: state.value,
        stains: state.stains,
        remaining: 10 - state.value,
      }),
      poolType: 'humanity-event',
      diceCount: 0,
      dice: [],
      successes: 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'humanity',
        rollKind: 'humanity_check',
        hungerDice: 0,
        humanityBefore: result.before.value,
        humanityAfter: state.value,
        stainsBefore: result.before.stains,
        stainsAfter: state.stains,
        stainEvents: [result.event],
        warnings: result.warning ? [result.warning] : [],
      },
    })
    deps.setConnectionText(result.warning || 'Сомнения сохранены')
    return updated
  }

  const performRemorseCheck = async (character: CharacterOption) => {
    const before = tableHumanity().getHumanityState({ humanity: character.humanity || { value: 7, stains: 0 } })
    if (before.stains <= 0) {
      deps.setConnectionText('Нет Сомнений для проверки')
      return null
    }

    const remorseDice = tableHumanity().getRemorseDice(before)
    const outcome = computeRemorseCheckOutcome({
      before,
      remorseDice,
      rollsDice: rollsDice(),
      tf: deps.tf,
      t: deps.t,
    })
    const updated = await updateCharacterHumanity(character.id, outcome.nextState, 'Проверка мук совести сохранена')
    if (!updated) return null

    await publishRoll(buildRemorseCheckRoll(character.name, deps.room, outcome))
    return updated
  }

  const spendWillpower = async (character: CharacterOption, amount = 1, reason = 'Воля: трата') => {
    const before = getCharacterWillpower(character)
    const result = applyWillpowerStressValue(before, amount)
    if (result.applied < amount) {
      window.alert(result.warnings[0] ? deps.t(result.warnings[0]) : deps.t('Волю сейчас потратить нельзя.'))
      return null
    }
    const updatedCharacter = await updateCharacterWillpower(character.id, result.tracker, 'Воля сохранена')
    if (!updatedCharacter) return null
    const after = getCharacterWillpower(updatedCharacter)
    await publishWillpowerEvent(updatedCharacter, reason, before, after, {
      spentWillpower: result.applied,
      warnings: result.warnings,
    })
    return { character: updatedCharacter, before, after, spent: result.applied, warnings: result.warnings }
  }

  const recoverWillpower = async (
    character: CharacterOption,
    amount: number,
    severity: 'superficial' | 'aggravated',
    reason: string,
  ) => {
    const before = getCharacterWillpower(character)
    const result = recoverWillpowerStressValue(before, amount, severity)
    if (result.recovered < 1) return null
    const updatedCharacter = await updateCharacterWillpower(character.id, result.tracker, 'Воля сохранена')
    if (!updatedCharacter) return null
    const after = getCharacterWillpower(updatedCharacter)
    await publishWillpowerEvent(updatedCharacter, reason, before, after, {
      recoveredWillpower: result.recovered,
    })
    return { character: updatedCharacter, before, after, recovered: result.recovered }
  }

  const adjustWillpowerStress = async (
    character: CharacterOption,
    severity: 'superficial' | 'aggravated',
    delta: number,
  ) => {
    const before = getCharacterWillpower(character)
    const next = { superficial: before.superficial, aggravated: before.aggravated }
    if (severity === 'aggravated') {
      next.aggravated = Math.max(0, Math.min(before.max, next.aggravated + delta))
      if (next.superficial + next.aggravated > before.max) {
        next.superficial = Math.max(0, before.max - next.aggravated)
      }
    } else {
      next.superficial = Math.max(0, Math.min(Math.max(0, before.max - next.aggravated), next.superficial + delta))
    }
    await updateCharacterWillpower(character.id, next, 'Воля сохранена')
  }

  const rollWillpowerCheck = async (character: CharacterOption) => {
    const willpower = getCharacterWillpower(character)
    if (willpower.current < 1) {
      window.alert(deps.t('Доступной Воли нет: проверку Воли бросить нельзя.'))
      return
    }
    await deps.rollQuickDiceRef.current(willpower.current, 'Проверка Воли', character, 'willpower-check', {
      skipHungerDice: true,
      source: 'willpower',
      warnings: ['Проверка Воли бросает текущую доступную Волю и не использует кубики Голода.'],
    })
  }

  const rollRouseCheck = async (character: CharacterOption, reason = 'Испытание Крови / Проверка Голода') => {
    const result = await performRouseCheck(character, reason)
    await publishRoll(buildRouseCheckRoll(
      character,
      deps.room,
      result,
      reason,
      rollsDice(),
      getCharacterBloodPotency,
    ))
  }

  const quenchHunger = async (character: CharacterOption, amount: number = 1) => {
    const current = getCharacterHunger(character)
    const delta = Math.max(1, Math.floor(Number(amount) || 1))
    const next = Math.max(0, Math.min(5, current - delta))
    if (next === current) return
    await updateCharacterHunger(character.id, next, 'Голод утолён')
  }

  const setHungerLevel = async (character: CharacterOption, level: number) => {
    const current = getCharacterHunger(character)
    const safeLevel = Math.max(1, Math.min(5, Math.floor(Number(level) || 1)))
    const next = current === safeLevel ? safeLevel - 1 : safeLevel
    if (next === current) return
    await updateCharacterHunger(character.id, next, 'Голод обновлён')
  }

  const cycleHealthCell = async (character: CharacterOption, index: number) => {
    const before = getCharacterHealth(character)
    const statuses = Array.from({ length: before.max }, (_, cellIndex) => {
      const cell = cellIndex + 1
      if (cell <= before.aggravated) return 'aggravated'
      if (cell <= before.aggravated + before.superficial) return 'superficial'
      return 'empty'
    })
    const current = statuses[index - 1] || 'empty'
    statuses[index - 1] = current === 'empty'
      ? 'superficial'
      : current === 'superficial'
        ? 'aggravated'
        : 'empty'
    const nextTracker = tableHealth().normalizeHealthTracker({
      ...tableHealth().toHealthTracker(before),
      superficial: statuses.filter(status => status === 'superficial').length,
      aggravated: statuses.filter(status => status === 'aggravated').length,
    }, getCharacterHealthStamina(character), getCharacterDamageProfile(character))
    await updateCharacterHealth(character.id, nextTracker, 'Здоровье сохранено')
  }

  const cycleWillpowerCell = async (character: CharacterOption, index: number) => {
    const before = getCharacterWillpower(character)
    const statuses = Array.from({ length: before.max }, (_, cellIndex) => {
      const cell = cellIndex + 1
      if (cell <= before.aggravated) return 'aggravated'
      if (cell <= before.aggravated + before.superficial) return 'superficial'
      return 'empty'
    })
    const current = statuses[index - 1] || 'empty'
    statuses[index - 1] = current === 'empty'
      ? 'superficial'
      : current === 'superficial'
        ? 'aggravated'
        : 'empty'
    const nextTracker = normalizeWillpowerTracker({
      superficial: statuses.filter(status => status === 'superficial').length,
      aggravated: statuses.filter(status => status === 'aggravated').length,
    }, before.max)
    await updateCharacterWillpower(character.id, nextTracker, 'Воля сохранена')
  }

  const removeHumanityStains = async (character: CharacterOption, amount = 1) => {
    const before = character.humanity || { value: 7, stains: 0 }
    const removed = Math.min(before.stains, Math.max(0, Math.floor(Number(amount) || 0)))
    if (!removed) return null
    return updateCharacterHumanity(
      character.id,
      { ...before, stains: before.stains - removed },
      'Сомнения сохранены',
    )
  }

  const mendVampireSuperficial = async (character: CharacterOption) => {
    const before = getCharacterHealth(character)
    if (before.superficial < 1) return
    const result = await performRouseCheck(character, 'Заживление лёгких повреждений')
    const mendAmount = tableHealth().getSuperficialMendAmount(getCharacterBloodPotency(character))
    const recovered = tableHealth().recoverHealthDamage(
      before,
      mendAmount,
      'superficial',
      getCharacterDamageProfile(character),
    )
    const updatedCharacter = await updateCharacterHealth(character.id, recovered.tracker, 'Здоровье и Голод сохранены')
    if (!updatedCharacter) return
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, 'Заживление лёгких повреждений', before, after, {
      hungerBefore: result.hungerBefore,
      hungerAfter: result.hungerAfter,
      rouseChecks: [result],
      healing: {
        type: 'vampire_superficial',
        amountSuperficial: recovered.recovered,
        rouseChecks: [result],
      },
      warnings: [getRouseWarning(result)].filter(Boolean),
    })
  }

  const mendVampireAggravated = async (character: CharacterOption) => {
    const before = getCharacterHealth(character)
    if (before.aggravated < 1) return
    if (!window.confirm(deps.t('По правилам это можно делать не чаще одного раза за ночь и требует 3 Испытания Крови. Продолжить?'))) return
    const lastMendDate = character.lastAggravatedMendAt ? new Date(character.lastAggravatedMendAt) : null
    const mendedTonight = Boolean(
      lastMendDate
      && !Number.isNaN(lastMendDate.getTime())
      && lastMendDate.toDateString() === new Date().toDateString(),
    )
    if (mendedTonight && !window.confirm(deps.t('Тяжёлый урон уже лечили этой ночью. Применить мастерский override?'))) return
    const checks: RouseCheckResult[] = []
    let hunger = getCharacterHunger(character)
    for (let index = 0; index < 3; index += 1) {
      const result = await performRouseCheck(
        character,
        deps.tf('Заживление тяжёлого повреждения {n}/3', { n: index + 1 }),
        hunger,
      )
      checks.push(result)
      hunger = result.hungerAfter
    }
    const recovered = tableHealth().recoverHealthDamage(before, 1, 'aggravated', getCharacterDamageProfile(character))
    const updatedCharacter = await updateCharacterHealth(character.id, recovered.tracker, 'Здоровье и Голод сохранены', {
      lastAggravatedMendAt: new Date().toISOString(),
    })
    if (!updatedCharacter) return
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, 'Заживление тяжёлого повреждения', before, after, {
      hungerBefore: checks[0]?.hungerBefore,
      hungerAfter: checks[checks.length - 1]?.hungerAfter,
      rouseChecks: checks,
      healing: {
        type: 'vampire_aggravated',
        amountAggravated: recovered.recovered,
        rouseChecks: checks,
      },
      warnings: checks.map(getRouseWarning).filter(Boolean),
    })
  }

  const recoverMortalHealth = async (character: CharacterOption) => {
    const amount = getAttributeDots(character.attributes, 'Выносливость')
    await recoverCharacterHealth(character, amount, 'superficial', 'Восстановление смертного', 'mortal_superficial')
  }

  const treatMortalHealth = async (character: CharacterOption) => {
    const medicine = Number(window.prompt(deps.t('Медицина лекаря:'), '1') || 0)
    if (medicine < 1) return
    const success = window.confirm(deps.tf(
      'Проверка Интеллект + Медицина успешна? Сложность: {difficulty}.',
      { difficulty: getCharacterHealth(character).aggravated },
    ))
    const before = getCharacterHealth(character)
    const converted = success ? Math.min(before.aggravated, Math.ceil(medicine / 2)) : 0
    const next = tableHealth().normalizeHealthTracker({
      ...tableHealth().toHealthTracker(before),
      aggravated: before.aggravated - converted,
      superficial: before.superficial + converted,
    }, getCharacterHealthStamina(character), getCharacterDamageProfile(character))
    const updatedCharacter = await updateCharacterHealth(character.id, next, 'Лечение смертного сохранено')
    if (!updatedCharacter) return
    await publishHealthEvent(updatedCharacter, 'Лечение смертного', before, getCharacterHealth(updatedCharacter), {
      healing: { type: 'mortal_aggravated_medicine', amountAggravated: converted },
      warnings: success
        ? ['Тяжёлые повреждения превращены в лёгкие. Восстановление занимает ночь.']
        : ['Проверка лечения провалена: здоровье не изменилось.'],
    })
  }

  const getRollCharacter = (roll: RollMessage) => {
    const characters = deps.getChatCharacters()
    const characterId = roll.meta?.characterId
    if (characterId) return characters.find(character => character.id === characterId) || null
    return characters.find(character => character.name === roll.characterName) || null
  }

  return {
    updateCharacterHunger,
    updateCharacterHumanity,
    updateCharacterWillpower,
    updateCharacterHealth,
    syncHealthCharacter,
    publishHealthEvent,
    publishWillpowerEvent,
    applyCharacterHealthDamage,
    recoverCharacterHealth,
    addHumanityStains,
    performRemorseCheck,
    spendWillpower,
    recoverWillpower,
    adjustWillpowerStress,
    rollWillpowerCheck,
    performRouseCheck,
    rollRouseCheck,
    quenchHunger,
    setHungerLevel,
    cycleHealthCell,
    cycleWillpowerCell,
    removeHumanityStains,
    mendVampireSuperficial,
    mendVampireAggravated,
    recoverMortalHealth,
    treatMortalHealth,
    getRollCharacter,
  }
}