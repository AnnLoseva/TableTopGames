export type DisciplineDurationType =
  | 'scene'
  | 'night'
  | 'turn'
  | 'permanent'

export type DisciplineDuration = {
  type: DisciplineDurationType
  turns?: number
}

export type ActiveEffectDuration = DisciplineDuration & {
  startedAt: string
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeDurationType(
  value: unknown,
): DisciplineDurationType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLocaleLowerCase('ru')
  if (!normalized) return null
  if (normalized === 'scene' || /сцен/.test(normalized)) return 'scene'
  if (normalized === 'night' || /ноч/.test(normalized)) return 'night'
  if (normalized === 'turn' || /ход|раунд|turn|round/.test(normalized)) return 'turn'
  if (
    normalized === 'permanent'
    || /постоян|навсегда|permanent|forever/.test(normalized)
  ) {
    return 'permanent'
  }
  return null
}

function getTurnCount(value: unknown) {
  if (typeof value !== 'string') return 1
  return Math.max(1, Math.floor(Number(value.match(/\d+/)?.[0]) || 1))
}

export function normalizeDisciplineDuration(
  duration: unknown,
  legacyDuration?: unknown,
): DisciplineDuration {
  if (isObject(duration)) {
    const type = normalizeDurationType(duration.type)
    if (type) {
      return {
        type,
        ...(type === 'turn'
          ? { turns: Math.max(1, Math.floor(Number(duration.turns) || 1)) }
          : {}),
      }
    }
  }

  const directType = normalizeDurationType(duration)
  if (directType) {
    return {
      type: directType,
      ...(directType === 'turn' ? { turns: getTurnCount(duration) } : {}),
    }
  }

  const legacyType = normalizeDurationType(legacyDuration)
  if (legacyType) {
    return {
      type: legacyType,
      ...(legacyType === 'turn'
        ? { turns: getTurnCount(legacyDuration) }
        : {}),
    }
  }

  return { type: 'scene' }
}

export function createActiveEffectDuration(
  duration: DisciplineDuration,
  startedAt = new Date().toISOString(),
): ActiveEffectDuration {
  return {
    ...duration,
    startedAt,
  }
}

export function getDurationRemainingUses(
  duration: DisciplineDuration,
) {
  return duration.type === 'turn'
    ? Math.max(1, Math.floor(Number(duration.turns) || 1))
    : null
}

export function getDisciplineDurationLabel(
  duration?: DisciplineDuration | null,
  t: (ru: string) => string = ru => ru,
  tf: (ru: string, vars: Record<string, string | number>) => string = (ru, vars) =>
    Object.entries(vars).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), ru),
) {
  if (!duration) return ''
  if (duration.type === 'scene') return t('до конца сцены')
  if (duration.type === 'night') return t('до конца ночи')
  if (duration.type === 'permanent') return t('постоянно')
  const turns = Math.max(1, Math.floor(Number(duration.turns) || 1))
  return tf('{turns} ход', { turns })
}
