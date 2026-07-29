import {
  addActiveEffect,
  getActiveEffects,
  removeActiveEffect,
} from '../active-effects'
import {
  payDisciplineCost,
  type DisciplineCostCharacter,
  type DisciplineCostPayment,
  type DisciplineCostSource,
  type PayDisciplineCostOptions,
} from '../costs'
import {
  createActiveEffectDuration,
  getDurationRemainingUses,
  normalizeDisciplineDuration,
} from '../durations'
import type {
  ActiveEffect,
  DisciplineEffect,
  DisciplinePowerMechanics,
} from '../schema'

type JsonObject = Record<string, unknown>
type DisciplinePowerInputValues = Record<string, string | number | boolean>

export type DisciplinePowerIdentity = {
  discipline: string
  power: string
  path?: string
  level?: number
}

export type ActivateDisciplinePowerOptions =
  & PayDisciplineCostOptions
  & {
    identity?: Partial<DisciplinePowerIdentity>
    legacyCost?: unknown
    legacyDuration?: unknown
    targetCharacterId?: string
    startedAt?: string
    inputValues?: DisciplinePowerInputValues
  }

export type ActivateDisciplinePowerResult<TCharacter> = {
  success: boolean
  error?: 'not_active_power' | 'already_active' | 'insufficient_willpower' | 'manual_cost'
  character: TCharacter
  payment: DisciplineCostPayment<TCharacter> | null
  activeEffects: ActiveEffect[]
  createdEffects: ActiveEffect[]
  warnings: string[]
}

export type DeactivateDisciplinePowerResult<TCharacter> = {
  success: boolean
  character: TCharacter
  activeEffects: ActiveEffect[]
  removedEffects: ActiveEffect[]
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getIdentity(
  mechanics: DisciplinePowerMechanics,
  fallback: Partial<DisciplinePowerIdentity> = {},
): DisciplinePowerIdentity {
  const identity = isObject(mechanics.identity) ? mechanics.identity : {}
  return {
    discipline: typeof identity.discipline === 'string'
      ? identity.discipline
      : fallback.discipline || '',
    power: typeof identity.power === 'string'
      ? identity.power
      : fallback.power || '',
    path: typeof identity.path === 'string'
      ? identity.path
      : fallback.path,
    level: typeof identity.level === 'number'
      ? identity.level
      : fallback.level,
  }
}

function samePower(
  activeEffect: ActiveEffect,
  identity: DisciplinePowerIdentity,
) {
  return activeEffect.active
    && activeEffect.source.discipline === identity.discipline
    && activeEffect.source.power === identity.power
    && (identity.path === undefined || activeEffect.source.path === identity.path)
}

function getActivationKind(mechanics: DisciplinePowerMechanics) {
  return isObject(mechanics.activation)
    && typeof mechanics.activation.kind === 'string'
    ? mechanics.activation.kind
    : ''
}

function getEffects(
  mechanics: DisciplinePowerMechanics,
  identity: DisciplinePowerIdentity,
): DisciplineEffect[] {
  if (Array.isArray(mechanics.effects) && mechanics.effects.length > 0) {
    return mechanics.effects
  }

  return [{
    type: 'manual_prompt',
    label: identity.power,
    message: `Активна сила «${identity.power}». Эффект применяется вручную.`,
  }]
}

function getInputValuesPayload(
  inputValues: DisciplinePowerInputValues | undefined,
) {
  if (!inputValues) return {}
  return Object.fromEntries(
    Object.entries(inputValues).filter(([, value]) => {
      if (typeof value === 'string') return value.trim().length > 0
      return value !== undefined && value !== null
    }),
  )
}

function withEffectInputPayload(
  effect: DisciplineEffect,
  inputValues: DisciplinePowerInputValues | undefined,
): DisciplineEffect {
  const inputPayload = getInputValuesPayload(inputValues)
  if (Object.keys(inputPayload).length === 0) return effect
  if (
    !isObject(effect)
    || (effect.type !== 'condition' && effect.type !== 'entity')
  ) return effect

  const currentPayload = isObject(effect.payload) ? effect.payload : {}
  return {
    ...effect,
    payload: {
      ...currentPayload,
      ...inputPayload,
    },
  }
}

export function isDisciplinePowerActive(
  characterData: unknown,
  mechanics: DisciplinePowerMechanics,
  fallbackIdentity: Partial<DisciplinePowerIdentity> = {},
) {
  const identity = getIdentity(mechanics, fallbackIdentity)
  return getActiveEffects(characterData).some(
    (activeEffect) => samePower(activeEffect, identity),
  )
}

export function activateDisciplinePower<
  TCharacter extends DisciplineCostCharacter,
>(
  character: TCharacter,
  mechanics: DisciplinePowerMechanics,
  options: ActivateDisciplinePowerOptions = {},
): ActivateDisciplinePowerResult<TCharacter> {
  const identity = getIdentity(mechanics, options.identity)
  const currentEffects = getActiveEffects(character)

  if (getActivationKind(mechanics) !== 'active') {
    return {
      success: false,
      error: 'not_active_power',
      character,
      payment: null,
      activeEffects: currentEffects,
      createdEffects: [],
      warnings: ['Сила не помечена как активная.'],
    }
  }

  if (currentEffects.some((effect) => samePower(effect, identity))) {
    return {
      success: false,
      error: 'already_active',
      character,
      payment: null,
      activeEffects: currentEffects,
      createdEffects: [],
      warnings: ['Сила уже активна.'],
    }
  }

  const payment = payDisciplineCost(
    character,
    {
      mechanics,
      legacyCost: options.legacyCost,
    } satisfies DisciplineCostSource,
    options,
  )
  if (!payment.success) {
    return {
      success: false,
      error: payment.error,
      character,
      payment,
      activeEffects: currentEffects,
      createdEffects: [],
      warnings: payment.warnings,
    }
  }

  const startedAt = options.startedAt || new Date().toISOString()
  const duration = normalizeDisciplineDuration(
    mechanics.duration,
    options.legacyDuration,
  )
  const durationState = createActiveEffectDuration(duration, startedAt)
  const createdEffects = getEffects(mechanics, identity).map(
    (effect, index): ActiveEffect => ({
      id: `${identity.discipline}:${identity.power}:${effect.id || index}:${startedAt}`,
      source: identity,
      effect: withEffectInputPayload(effect, options.inputValues),
      targetCharacterId: options.targetCharacterId,
      startedAt,
      expiresAt: duration.type === 'permanent' ? null : undefined,
      remainingUses: getDurationRemainingUses(duration),
      duration: durationState,
      active: true,
    }),
  )

  let nextCharacterValue: unknown = payment.character
  createdEffects.forEach((activeEffect) => {
    nextCharacterValue = addActiveEffect(nextCharacterValue, activeEffect)
  })
  const nextCharacter = nextCharacterValue as TCharacter

  return {
    success: true,
    character: nextCharacter,
    payment: {
      ...payment,
      character: nextCharacter,
    },
    activeEffects: getActiveEffects(nextCharacter),
    createdEffects,
    warnings: payment.warnings,
  }
}

export function deactivateDisciplinePower<TCharacter>(
  character: TCharacter,
  mechanics: DisciplinePowerMechanics,
  fallbackIdentity: Partial<DisciplinePowerIdentity> = {},
): DeactivateDisciplinePowerResult<TCharacter> {
  const identity = getIdentity(mechanics, fallbackIdentity)
  const currentEffects = getActiveEffects(character)
  const removedEffects = currentEffects.filter(
    (activeEffect) => samePower(activeEffect, identity),
  )
  let nextCharacterValue: unknown = character
  removedEffects.forEach((activeEffect) => {
    nextCharacterValue = removeActiveEffect(
      nextCharacterValue,
      activeEffect.id,
    )
  })
  const nextCharacter = nextCharacterValue as TCharacter

  return {
    success: removedEffects.length > 0,
    character: nextCharacter,
    activeEffects: getActiveEffects(nextCharacter),
    removedEffects,
  }
}
