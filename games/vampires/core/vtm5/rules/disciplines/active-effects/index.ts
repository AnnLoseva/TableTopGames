import type { ActiveEffect, DisciplineEffect } from '../schema'

type JsonObject = Record<string, unknown>
type ActiveEffectExpirationScope = 'turn' | 'scene' | 'night'

export type ExpireActiveEffectsOptions = {
  scope?: ActiveEffectExpirationScope
  now?: string | Date
}

export type ExpireActiveEffectsResult<TCharacter> = {
  character: TCharacter
  activeEffects: ActiveEffect[]
  expiredEffects: ActiveEffect[]
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getCharacterData(characterData: unknown): JsonObject {
  if (!isObject(characterData)) return {}
  return isObject(characterData.data) ? characterData.data : characterData
}

function normalizeActiveEffect(value: unknown): ActiveEffect | null {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id.trim()) {
    return null
  }

  const source = isObject(value.source) ? value.source : {}
  const effect = isObject(value.effect) && typeof value.effect.type === 'string'
    ? value.effect as DisciplineEffect
    : null
  if (!effect) return null

  return {
    ...value,
    id: value.id,
    source: {
      discipline: typeof source.discipline === 'string' ? source.discipline : '',
      power: typeof source.power === 'string' ? source.power : '',
      path: typeof source.path === 'string' ? source.path : undefined,
      level: typeof source.level === 'number' ? source.level : undefined,
    },
    effect,
    targetCharacterId: typeof value.targetCharacterId === 'string'
      ? value.targetCharacterId
      : undefined,
    startedAt: typeof value.startedAt === 'string'
      ? value.startedAt
      : new Date(0).toISOString(),
    expiresAt: typeof value.expiresAt === 'string' || value.expiresAt === null
      ? value.expiresAt
      : undefined,
    remainingUses: typeof value.remainingUses === 'number'
      || value.remainingUses === null
      ? value.remainingUses
      : undefined,
    duration: isObject(value.duration)
      && (
        value.duration.type === 'scene'
        || value.duration.type === 'night'
        || value.duration.type === 'turn'
        || value.duration.type === 'permanent'
      )
      ? {
          type: value.duration.type,
          turns: typeof value.duration.turns === 'number'
            ? value.duration.turns
            : undefined,
          startedAt: typeof value.duration.startedAt === 'string'
            ? value.duration.startedAt
            : typeof value.startedAt === 'string'
              ? value.startedAt
              : new Date(0).toISOString(),
        }
      : undefined,
    active: value.active !== false,
  }
}

function withActiveEffects(
  characterData: unknown,
  activeEffects: ActiveEffect[],
) {
  if (!isObject(characterData)) return { activeEffects }
  if (isObject(characterData.data)) {
    return {
      ...characterData,
      data: {
        ...characterData.data,
        activeEffects,
      },
    }
  }
  return { ...characterData, activeEffects }
}

export function getActiveEffects(characterData: unknown): ActiveEffect[] {
  const data = getCharacterData(characterData)
  if (!Array.isArray(data.activeEffects)) return []
  return data.activeEffects
    .map(normalizeActiveEffect)
    .filter((effect): effect is ActiveEffect => Boolean(effect))
}

export function addActiveEffect(
  characterData: unknown,
  activeEffect: ActiveEffect,
) {
  const normalized = normalizeActiveEffect(activeEffect)
  if (!normalized) return withActiveEffects(
    characterData,
    getActiveEffects(characterData),
  )

  return withActiveEffects(characterData, [
    ...getActiveEffects(characterData).filter(
      (effect) => effect.id !== normalized.id,
    ),
    normalized,
  ])
}

export function removeActiveEffect(
  characterData: unknown,
  effectId: string,
) {
  return withActiveEffects(
    characterData,
    getActiveEffects(characterData).filter(
      (effect) => effect.id !== effectId,
    ),
  )
}

function getNowMs(value: string | Date | undefined) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : Date.now()
  }
  return Date.now()
}

function getRemainingUses(effect: ActiveEffect) {
  if (typeof effect.remainingUses === 'number') {
    return Math.max(0, Math.floor(effect.remainingUses))
  }
  if (effect.duration?.type === 'turn') {
    return Math.max(1, Math.floor(Number(effect.duration.turns) || 1))
  }
  return null
}

function isScopeExpired(
  effect: ActiveEffect,
  scope: ActiveEffectExpirationScope | undefined,
) {
  if (!scope || !effect.duration) return false
  if (scope === 'turn') return effect.duration.type === 'turn'
  if (scope === 'scene') {
    return effect.duration.type === 'turn' || effect.duration.type === 'scene'
  }
  return effect.duration.type !== 'permanent'
}

function advanceTurnEffect(effect: ActiveEffect) {
  if (effect.duration?.type !== 'turn') return effect
  const remaining = getRemainingUses(effect)
  if (remaining === null || remaining <= 1) return null
  return { ...effect, remainingUses: remaining - 1 }
}

export function expireActiveEffects<TCharacter>(
  characterData: TCharacter,
  options: ExpireActiveEffectsOptions = {},
): ExpireActiveEffectsResult<TCharacter> {
  const nowMs = getNowMs(options.now)
  const activeEffects: ActiveEffect[] = []
  const expiredEffects: ActiveEffect[] = []

  for (const effect of getActiveEffects(characterData)) {
    const expiresAtMs = typeof effect.expiresAt === 'string'
      ? Date.parse(effect.expiresAt)
      : Number.NaN
    const expiredByTime = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs
    if (expiredByTime || isScopeExpired(effect, options.scope)) {
      const advanced = options.scope === 'turn' && !expiredByTime
        ? advanceTurnEffect(effect)
        : null
      if (advanced) activeEffects.push(advanced)
      else expiredEffects.push(effect)
      continue
    }
    activeEffects.push(effect)
  }

  return {
    character: withActiveEffects(characterData, activeEffects) as TCharacter,
    activeEffects,
    expiredEffects,
  }
}
