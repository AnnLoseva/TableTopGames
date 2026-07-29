import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { DisciplineCost } from '@/games/vampires/core/vtm5/rules/disciplines/costs'
import type { DisciplineCostPayment } from '@/games/vampires/core/vtm5/rules/disciplines/costs'
import type { DisciplineRollPenalty } from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type { ActiveEffect } from '@/games/vampires/core/vtm5/rules/disciplines/schema'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { DisciplineRollContext, QuickRollOptions } from '@/games/vampires/modules/rolls/types'
import { getRouseWarning } from '@/games/vampires/modules/rolls/utils'
import { rollsDice } from '@/games/vampires/modules/rolls/system-runtime'
import { fetchCharacterById, updateCharacterData } from '../api/character-api'
import { mapCharacterRow } from '../mappers'
import { tableDisciplines } from '../system-runtime'
import {
  getCharacterBloodPotency,
  getCharacterHunger,
  getCharacterWillpower,
  getWillpowerMetaState,
} from '../utils/character-state'
import type { DisciplinePowerEntry, PowerPoolChoice } from '../utils/discipline-ui'
import { getCharacterPoolPartDots } from '../utils/discipline-ui'
import { getRollPenalties, getRollTraits } from '../utils/roll-pool-helpers'
import type {
  ActiveParticipant,
  CharacterOption,
  CharacterRow,
  Die,
  RollMessage,
  RollMeta,
  RouseCheckResult,
} from '../types'
import type { createCharacterActions } from './character-actions'

export type DisciplineActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  previewDisciplineName: string
  chatUser: ChatUser | null
  selectedActiveCharacterId: string | null
  setChatCharacters: Dispatch<SetStateAction<CharacterOption[]>>
  setPreviewCharacter: Dispatch<SetStateAction<CharacterOption | null>>
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
  addHumanityStains: ReturnType<typeof createCharacterActions>['addHumanityStains']
}

export type RollPreviewPowerParams = {
  previewCharacter: CharacterOption
  selectedPreviewPower: DisciplinePowerEntry
  canRollPreview: boolean
  hasMissingPreviewPowerInput: boolean
  previewDisciplineName: string
  selectedPreviewPowerCostLabel: string
  selectedPreviewPowerCost: DisciplineCost
  previewPowerInputValues: Record<string, string>
  previewPowerDiceCount: number
  previewPowerPoolChoices: PowerPoolChoice[]
  previewPowerPoolBeforeLimit: number
  previewPowerPoolSelections: string[]
  previewPowerModifier: number
  previewPowerWillpowerImpairmentPenalty: number
  previewPowerHealthImpairmentPenalty: number
  disabledPreviewPowerModifierIds: string[]
}

export type DeactivatePreviewPowerParams = {
  previewCharacter: CharacterOption
  selectedPreviewPower: DisciplinePowerEntry
  canRollPreview: boolean
  selectedPreviewPowerIsActive: boolean
  previewDisciplineName: string
}

export type RemovePreviewActiveEffectParams = {
  previewCharacter: CharacterOption
  chatUser: ChatUser
  canEditPreviewActiveEffects: boolean
  effectId: string
}

function syncCharacterInState(
  deps: DisciplineActionsDeps,
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

function broadcastActiveCharacter(
  deps: DisciplineActionsDeps,
  character: CharacterOption,
) {
  if (!deps.chatUser || deps.selectedActiveCharacterId !== character.id) return
  const participant: ActiveParticipant = {
    userId: deps.chatUser.id,
    username: deps.chatUser.username,
    characterId: character.id,
    characterName: character.name || 'без персонажа',
    characterClan: character.clan || null,
    characterImage: character.image || '',
    updatedAt: new Date().toISOString(),
  }
  deps.broadcast('active-character', { room: deps.room, participant })
}

export function createDisciplineActions(deps: DisciplineActionsDeps) {
  const publishRoll = (roll: RollMessage) => deps.publishRollRef.current(roll)

  const payActivateAndSaveDisciplinePower = async (
    character: CharacterOption,
    power: DisciplinePowerEntry,
    cost: DisciplineCost,
    disciplineName: string,
    inputValues: Record<string, string> = {},
  ) => {
    let rouseChecksOverride: number | undefined
    if (cost.variableRouseChecks) {
      const answer = window.prompt(
        deps.t('Сколько Испытаний Крови сделать для этой силы?'),
        String(Math.max(1, cost.rouseChecks)),
      )
      if (answer === null) return null
      rouseChecksOverride = Math.max(
        1,
        Math.min(5, Math.floor(Number(answer) || cost.rouseChecks || 1)),
      )
    }

    const { row: data, error } = await fetchCharacterById(character.id)

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для оплаты силы:', error)
      deps.setConnectionText('Цена силы не оплачена')
      return null
    }

    const storedCharacter = mapCharacterRow(data as CharacterRow)
    const isActivePower = power.rule.mechanics?.activation?.kind === 'active'
    let payment: DisciplineCostPayment<CharacterOption>
    let nextActiveEffects: ActiveEffect[] | undefined
    let activated = false

    if (isActivePower) {
      const activation = tableDisciplines().activateDisciplinePower(
        storedCharacter,
        power.rule.mechanics || {},
        {
          identity: {
            discipline: disciplineName,
            path: power.path,
            power: power.name,
            level: power.level,
          },
          legacyCost: power.rule.cost,
          legacyDuration: power.rule.duration,
          targetCharacterId: storedCharacter.id,
          reason: `${disciplineName}: ${power.name}`,
          rouseChecksOverride,
          inputValues,
          t: deps.t,
          tf: deps.tf,
        },
      )
      if (!activation.success || !activation.payment) {
        deps.setConnectionText(activation.warnings[0] || 'Сила не активирована')
        return null
      }
      payment = activation.payment
      nextActiveEffects = activation.activeEffects
      activated = activation.createdEffects.length > 0
    } else {
      payment = tableDisciplines().payDisciplineCost(
        storedCharacter,
        {
          mechanics: power.rule.mechanics,
          legacyCost: power.rule.cost,
        },
        {
          reason: `${disciplineName}: ${power.name}`,
          rouseChecksOverride,
          t: deps.t,
          tf: deps.tf,
        },
      )
      if (!payment.success) {
        deps.setConnectionText(payment.warnings[0] || 'Цена силы требует ручного решения')
        return null
      }
    }

    const hasAutomaticCost = payment.rouseChecks.length > 0 || payment.spentWillpower > 0
    if (!hasAutomaticCost && !activated) {
      return { character: storedCharacter, payment, activated }
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const nextData = {
      ...characterData,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        ...(payment.rouseChecks.length > 0 ? { hunger: payment.hungerAfter } : {}),
        ...(payment.spentWillpower > 0
          ? {
              willpower: {
                superficial: payment.willpowerAfter.superficial,
                aggravated: payment.willpowerAfter.aggravated,
              },
            }
          : {}),
      },
      ...(nextActiveEffects ? { activeEffects: nextActiveEffects } : {}),
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(character.id, nextData)

    if (updateError) {
      console.error('Не удалось сохранить оплату силы:', updateError)
      deps.setConnectionText('Цена силы не сохранилась')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncCharacterInState(deps, character.id, updatedCharacter)
    broadcastActiveCharacter(deps, updatedCharacter)
    deps.setConnectionText(activated ? 'Сила активирована' : 'Цена силы оплачена')
    return { character: updatedCharacter, payment, activated }
  }

  const publishDisciplineActivation = async (
    character: CharacterOption,
    context: DisciplineRollContext,
    rouseChecks: RouseCheckResult[],
    willpowerMeta: Partial<RollMeta> = {},
    action: 'Активация' | 'Отключение' = 'Активация',
  ) => {
    const dice = rouseChecks.map(result => ({
      value: result.value,
      kind: rollsDice().getDieKind(result.value, false),
    } as Die))
    const hungerBefore = rouseChecks[0]?.hungerBefore ?? getCharacterHunger(character)
    const hungerAfter = rouseChecks[rouseChecks.length - 1]?.hungerAfter ?? hungerBefore
    const warnings = rouseChecks.map(getRouseWarning).filter(Boolean)

    await publishRoll({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: deps.room,
      characterName: character.name,
      poolName: `${context.name}: ${context.power} · ${deps.t(action)}`,
      poolType: 'discipline-power',
      diceCount: dice.length,
      dice,
      successes: rouseChecks.filter(result => result.success).length,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'discipline',
        hungerBefore,
        hungerAfter,
        hungerDice: 0,
        bloodPotency: getCharacterBloodPotency(character),
        rouseChecks,
        discipline: context,
        warnings: [...warnings, ...(willpowerMeta.warnings || [])],
        characterId: character.id,
        willpowerBefore: willpowerMeta.willpowerBefore || getWillpowerMetaState(getCharacterWillpower(character)),
        willpowerAfter: willpowerMeta.willpowerAfter || getWillpowerMetaState(getCharacterWillpower(character)),
        spentWillpower: willpowerMeta.spentWillpower,
        recoveredWillpower: willpowerMeta.recoveredWillpower,
        willpowerImpaired: getCharacterWillpower(character).impaired,
      },
    })
  }

  const deactivatePreviewDisciplinePower = async (input: DeactivatePreviewPowerParams) => {
    if (
      !input.previewCharacter
      || !input.selectedPreviewPower
      || !input.selectedPreviewPowerIsActive
      || !input.canRollPreview
    ) return

    const { row: data, error } = await fetchCharacterById(input.previewCharacter.id)

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для отключения силы:', error)
      deps.setConnectionText('Сила не отключена')
      return
    }

    const storedCharacter = mapCharacterRow(data as CharacterRow)
    const deactivation = tableDisciplines().deactivateDisciplinePower(
      storedCharacter,
      input.selectedPreviewPower.rule.mechanics || {},
      {
        discipline: input.previewDisciplineName,
        path: input.selectedPreviewPower.path,
        power: input.selectedPreviewPower.name,
        level: input.selectedPreviewPower.level,
      },
    )
    if (!deactivation.success) {
      deps.setConnectionText('Активный эффект силы не найден')
      return
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const nextData = {
      ...characterData,
      activeEffects: deactivation.activeEffects,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(input.previewCharacter.id, nextData)

    if (updateError) {
      console.error('Не удалось сохранить отключение силы:', updateError)
      deps.setConnectionText('Сила не отключена')
      return
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncCharacterInState(deps, updatedCharacter.id, updatedCharacter)
    deps.setConnectionText('Сила отключена')

    await publishDisciplineActivation(
      updatedCharacter,
      {
        name: input.previewDisciplineName,
        power: input.selectedPreviewPower.name,
        level: input.selectedPreviewPower.level,
        cost: deps.t('без оплаты'),
      },
      [],
      { warnings: ['Активный эффект силы отключён.'] },
      'Отключение',
    )
  }

  const rollPreviewPower = async (input: RollPreviewPowerParams) => {
    if (!input.previewCharacter || !input.selectedPreviewPower || !input.canRollPreview) return
    if (input.hasMissingPreviewPowerInput) {
      deps.setConnectionText('Заполни поля силы перед активацией')
      return
    }

    let activeCharacter = input.previewCharacter
    let willpowerMeta: Partial<RollMeta> = {}
    const context: DisciplineRollContext = {
      name: input.previewDisciplineName,
      power: input.selectedPreviewPower.name,
      level: input.selectedPreviewPower.level,
      cost: input.selectedPreviewPowerCostLabel,
    }

    const humanityRisk = input.selectedPreviewPower.rule.mechanics?.humanity
    if (humanityRisk?.risk) {
      const suggested = Math.max(1, Math.floor(Number(humanityRisk.suggestedStains) || 1))
      const answer = window.prompt(
        deps.t('Эта сила может угрожать Человечности. Добавить Сомнения?\n\n1 — +1\n2 — +2\n0 — не добавлять\nДругое число — ручное значение'),
        String(suggested),
      )
      if (answer !== null) {
        const amount = Math.max(0, Math.min(10, Math.floor(Number(answer) || 0)))
        if (amount > 0) {
          const updated = await deps.addHumanityStains(activeCharacter, amount, 'использование силы с риском Человечности', {
            source: 'discipline_risk',
            reasonText: humanityRisk.reason || `${input.previewDisciplineName}: ${input.selectedPreviewPower.name}`,
          })
          if (updated) activeCharacter = updated
        }
      }
    }

    const costResult = await payActivateAndSaveDisciplinePower(
      activeCharacter,
      input.selectedPreviewPower,
      input.selectedPreviewPowerCost,
      input.previewDisciplineName,
      input.previewPowerInputValues,
    )
    if (!costResult) return
    activeCharacter = costResult.character
    const rouseChecks = costResult.payment.rouseChecks
    willpowerMeta = {
      willpowerBefore: getWillpowerMetaState(costResult.payment.willpowerBefore),
      willpowerAfter: getWillpowerMetaState(costResult.payment.willpowerAfter),
      spentWillpower: costResult.payment.spentWillpower || undefined,
      warnings: costResult.payment.warnings,
    }

    const rollPenalties = getRollPenalties(
      deps.t,
      input.previewPowerWillpowerImpairmentPenalty,
      input.previewPowerHealthImpairmentPenalty,
    )

    if (input.previewPowerDiceCount < 1 || input.previewPowerPoolChoices.length === 0) {
      if (costResult.activated || rouseChecks.length > 0 || willpowerMeta.spentWillpower) {
        await publishDisciplineActivation(activeCharacter, context, rouseChecks, willpowerMeta)
        return
      }
      window.alert(deps.t('Для этой силы автоматический бросок не указан. Используй обычный конструктор пула.'))
      return
    }

    const selectedParts = input.previewPowerPoolSelections.map(name => (
      `${deps.t(name)} ${getCharacterPoolPartDots(activeCharacter, name)}`
    ))
    if (input.previewPowerModifier) {
      selectedParts.push(`${deps.t('модификатор')} ${input.previewPowerModifier > 0 ? '+' : ''}${input.previewPowerModifier}`)
    }

    await deps.rollQuickDiceRef.current(
      input.previewPowerPoolBeforeLimit,
      `${input.previewDisciplineName}: ${input.selectedPreviewPower.name} · ${selectedParts.join(' + ')}`,
      activeCharacter,
      'discipline-power',
      {
        source: 'discipline',
        disciplineContext: context,
        rouseChecks,
        willpowerBefore: willpowerMeta.willpowerBefore,
        willpowerAfter: willpowerMeta.willpowerAfter,
        spentWillpower: willpowerMeta.spentWillpower,
        rollTraits: getRollTraits(...input.previewPowerPoolSelections, input.previewDisciplineName),
        rollAction: input.selectedPreviewPower.name,
        rollPenalties,
        disabledRollModifierIds: input.disabledPreviewPowerModifierIds,
        warnings: [...(willpowerMeta.warnings || [])],
      },
    )
  }

  const removePreviewActiveEffect = async (input: RemovePreviewActiveEffectParams) => {
    if (!input.previewCharacter?.id || !input.canEditPreviewActiveEffects) return

    deps.setConnectionText('Удаляю эффект...')
    const { row: data, error } = await fetchCharacterById(input.previewCharacter.id, { userId: input.chatUser.id })

    if (error || !data?.data) {
      console.error('Не удалось прочитать активные эффекты персонажа:', error)
      deps.setConnectionText('Эффект не удалён')
      return
    }

    const storedCharacter = mapCharacterRow(data as CharacterRow)
    const targetEffect = storedCharacter.activeEffects.find(
      activeEffect => activeEffect.id === input.effectId,
    )
    const deactivation = targetEffect
      ? tableDisciplines().deactivateDisciplinePower(
          storedCharacter,
          {
            identity: targetEffect.source,
            activation: { kind: 'active' },
          },
          targetEffect.source,
        )
      : null
    const withoutEffect = deactivation?.success
      ? {
          ...(data.data as NonNullable<CharacterRow['data']>),
          activeEffects: deactivation.activeEffects,
        }
      : tableDisciplines().removeActiveEffect(data.data, input.effectId) as NonNullable<CharacterRow['data']>
    const nextData = {
      ...withoutEffect,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(input.previewCharacter.id, nextData, {
      userId: input.chatUser.id,
    })

    if (updateError) {
      console.error('Не удалось удалить активный эффект:', updateError)
      deps.setConnectionText('Эффект не удалён')
      return
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncCharacterInState(deps, updatedCharacter.id, updatedCharacter)
    deps.setConnectionText('Эффект отключён')

    if (targetEffect) {
      await publishDisciplineActivation(
        updatedCharacter,
        {
          name: targetEffect.source.discipline,
          power: targetEffect.source.power,
          level: targetEffect.source.level || 0,
          cost: deps.t('без оплаты'),
        },
        [],
        { warnings: ['Активный эффект силы отключён.'] },
        'Отключение',
      )
    }
  }

  return {
    payActivateAndSaveDisciplinePower,
    publishDisciplineActivation,
    deactivatePreviewDisciplinePower,
    rollPreviewPower,
    removePreviewActiveEffect,
  }
}