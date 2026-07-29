export type HumanityStainSource =
  | 'manual'
  | 'chronicle_tenet_violation'
  | 'conviction_violation'
  | 'touchstone_harmed'
  | 'predator_type_flaw'
  | 'discipline_risk'
  | 'diablerie'
  | 'storyteller'

export type HumanityStainEvent = {
  id: string
  amount: number
  requestedAmount?: number
  source: HumanityStainSource
  reason: string
  reasonText?: string
  createdAt: string
  mitigatedByConviction?: boolean
  relatedConvictionId?: string
  relatedTouchstoneId?: string
}

export type HumanityState = {
  value: number
  stains: number
  stainEvents?: HumanityStainEvent[]
  lastRemorseCheckAt?: string | null
  lastHumanityLossAt?: string | null
}

export type Conviction = {
  id: string
  text: string
  touchstoneId?: string
}

export type Touchstone = {
  id: string
  name: string
  description?: string
  status?: 'safe' | 'threatened' | 'harmed' | 'lost'
}

export type MoralityState = {
  chronicleTenets: string[]
  convictions: Conviction[]
  touchstones: Touchstone[]
}

export type HumanityStatus = 'normal' | 'stained' | 'at_risk' | 'lost_to_beast'

type CharacterDataLike = {
  humanity?: unknown
  baseHumanity?: unknown
  vitalTrackers?: {
    humanity?: unknown
  } | null
  morality?: unknown
}

type StainOptions = {
  source: HumanityStainSource
  reasonText?: string
  mitigatedByConviction?: boolean
  relatedConvictionId?: string
  relatedTouchstoneId?: string
}

const STAIN_SOURCE_LABELS: Record<HumanityStainSource, string> = {
  manual: 'ручное решение',
  chronicle_tenet_violation: 'нарушение принципа хроники',
  conviction_violation: 'нарушение Убеждения',
  touchstone_harmed: 'вред Опоре',
  predator_type_flaw: 'нарушение пищевого правила',
  discipline_risk: 'использование силы с риском Человечности',
  diablerie: 'диаблери',
  storyteller: 'решение Рассказчика',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function clampHumanityValue(value: unknown, fallback = 7) {
  const parsed = Number(value)
  const safe = Number.isFinite(parsed) ? Math.floor(parsed) : fallback
  return Math.max(0, Math.min(10, safe))
}

export function clampHumanityStains(value: unknown, humanityValue: number) {
  const parsed = Number(value)
  const safe = Number.isFinite(parsed) ? Math.floor(parsed) : 0
  return Math.max(0, Math.min(10 - clampHumanityValue(humanityValue), safe))
}

function normalizeStainEvent(value: unknown, index: number): HumanityStainEvent | null {
  if (!isRecord(value)) return null
  const sourceKey = typeof value.source === 'string' ? value.source : ''
  const source = Object.prototype.hasOwnProperty.call(STAIN_SOURCE_LABELS, sourceKey)
    ? sourceKey as HumanityStainSource
    : 'manual'
  const amount = Math.max(0, Math.floor(Number(value.amount) || 0))
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `legacy-stain-${index}`,
    amount,
    requestedAmount: typeof value.requestedAmount === 'number' ? value.requestedAmount : undefined,
    source,
    reason: typeof value.reason === 'string' && value.reason ? value.reason : STAIN_SOURCE_LABELS[source],
    reasonText: typeof value.reasonText === 'string' ? value.reasonText : undefined,
    createdAt: typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : new Date(0).toISOString(),
    mitigatedByConviction: typeof value.mitigatedByConviction === 'boolean' ? value.mitigatedByConviction : undefined,
    relatedConvictionId: typeof value.relatedConvictionId === 'string' ? value.relatedConvictionId : undefined,
    relatedTouchstoneId: typeof value.relatedTouchstoneId === 'string' ? value.relatedTouchstoneId : undefined,
  }
}

export function getHumanityState(characterData: CharacterDataLike | null | undefined): HumanityState {
  const data = characterData || {}
  const rawHumanity = data.humanity
  let rawValue: unknown
  let rawStains: unknown = 0
  let rawEvents: unknown[] = []
  let lastRemorseCheckAt: string | null = null
  let lastHumanityLossAt: string | null = null

  if (typeof rawHumanity === 'number' || typeof rawHumanity === 'string') {
    rawValue = rawHumanity
  } else if (isRecord(rawHumanity)) {
    rawValue = rawHumanity.value
    rawStains = rawHumanity.stains
    rawEvents = Array.isArray(rawHumanity.stainEvents) ? rawHumanity.stainEvents : []
    lastRemorseCheckAt = typeof rawHumanity.lastRemorseCheckAt === 'string' ? rawHumanity.lastRemorseCheckAt : null
    lastHumanityLossAt = typeof rawHumanity.lastHumanityLossAt === 'string' ? rawHumanity.lastHumanityLossAt : null
  }

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    rawValue = data.vitalTrackers?.humanity ?? data.baseHumanity ?? 7
  }

  const value = clampHumanityValue(rawValue)
  return {
    value,
    stains: clampHumanityStains(rawStains, value),
    stainEvents: rawEvents
      .map(normalizeStainEvent)
      .filter((event): event is HumanityStainEvent => Boolean(event))
      .slice(-100),
    lastRemorseCheckAt,
    lastHumanityLossAt,
  }
}

export function getHumanityStatus(state: HumanityState): HumanityStatus {
  if (state.value <= 0) return 'lost_to_beast'
  if (state.stains >= 10 - state.value && state.stains > 0) return 'at_risk'
  if (state.stains > 0) return 'stained'
  return 'normal'
}

const identityT = (ru: string) => ru

export const HUMANITY_WARNING_AT_RISK =
  'Шкала Сомнений заполнена. Следующая проверка мук совести почти наверняка приведёт к потере Человечности.'

export const HUMANITY_WARNING_LOST_TO_BEAST =
  'Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.'

export function getHumanityWarning(
  state: HumanityState,
  t: (ru: string) => string = identityT,
): string {
  if (state.value <= 0) return t(HUMANITY_WARNING_LOST_TO_BEAST)
  if (state.stains >= 10 - clampHumanityValue(state.value) && state.stains > 0) {
    return t(HUMANITY_WARNING_AT_RISK)
  }
  return ''
}

export function getRemorseDice(state: HumanityState) {
  return Math.max(0, 10 - clampHumanityValue(state.value) - clampHumanityStains(state.stains, state.value))
}

export type RemorseCheckResolution = {
  automaticFailure: boolean
  successes: number
  success: boolean
  humanityAfter: number
  nextState: HumanityState
}

/** Applies remorse-check dice results to humanity state. Dice rolling stays with the caller. */
export function applyRemorseCheckResult(
  before: HumanityState,
  params: {
    remorseDice: number
    diceValues: number[]
    checkedAt?: string
  },
): RemorseCheckResolution {
  const remorseDice = Math.max(0, Math.floor(Number(params.remorseDice) || 0))
  const automaticFailure = remorseDice <= 0
  const diceValues = Array.isArray(params.diceValues) ? params.diceValues : []
  const successes = diceValues.filter(value => Number(value) >= 6).length
  const success = !automaticFailure && successes > 0
  const humanityAfter = success ? before.value : Math.max(0, before.value - 1)
  const now = params.checkedAt || new Date().toISOString()
  const nextState: HumanityState = {
    ...before,
    value: humanityAfter,
    stains: 0,
    lastRemorseCheckAt: now,
    lastHumanityLossAt: success ? before.lastHumanityLossAt : now,
  }
  return {
    automaticFailure,
    successes,
    success,
    humanityAfter,
    nextState,
  }
}

export function getStainSourceLabel(source: HumanityStainSource) {
  return STAIN_SOURCE_LABELS[source]
}

export function addHumanityStains(
  characterData: CharacterDataLike | null | undefined,
  amount: number,
  reason: string,
  options: StainOptions,
) {
  const before = getHumanityState(characterData)
  const requestedAmount = Math.max(0, Math.floor(Number(amount) || 0))
  const freeBoxes = Math.max(0, 10 - before.value - before.stains)
  const applied = Math.min(requestedAmount, freeBoxes)
  const event: HumanityStainEvent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    amount: applied,
    requestedAmount,
    source: options.source,
    reason: reason || getStainSourceLabel(options.source),
    reasonText: options.reasonText,
    createdAt: new Date().toISOString(),
    mitigatedByConviction: options.mitigatedByConviction,
    relatedConvictionId: options.relatedConvictionId,
    relatedTouchstoneId: options.relatedTouchstoneId,
  }
  const next: HumanityState = {
    ...before,
    stains: before.stains + applied,
    stainEvents: [...(before.stainEvents || []), event].slice(-100),
  }
  return {
    before,
    humanity: next,
    event,
    requestedAmount,
    applied,
    overflow: requestedAmount - applied,
    warning: requestedAmount > applied
      ? getHumanityWarning({ ...before, stains: before.stains + applied }, identityT)
      : '',
  }
}

export function normalizeMoralityState(value: unknown): MoralityState {
  const source = isRecord(value) ? value : {}
  const chronicleTenets = Array.isArray(source.chronicleTenets)
    ? source.chronicleTenets.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : []
  const convictions = Array.isArray(source.convictions)
    ? source.convictions.flatMap((item, index) => {
      if (typeof item === 'string') return [{ id: `conviction-${index}`, text: item }]
      if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim()) return []
      return [{
        id: typeof item.id === 'string' && item.id ? item.id : `conviction-${index}`,
        text: item.text,
        touchstoneId: typeof item.touchstoneId === 'string' ? item.touchstoneId : undefined,
      }]
    })
    : []
  const touchstones: Touchstone[] = Array.isArray(source.touchstones)
    ? source.touchstones.reduce<Touchstone[]>((result, item, index) => {
      if (typeof item === 'string') {
        result.push({ id: `touchstone-${index}`, name: item, status: 'safe' })
        return result
      }
      if (!isRecord(item)) return result
      const name = String(item.name || item.text || '').trim()
      if (!name) return result
      const status: NonNullable<Touchstone['status']> = ['safe', 'threatened', 'harmed', 'lost'].includes(String(item.status))
        ? item.status as NonNullable<Touchstone['status']>
        : 'safe'
      result.push({
        id: typeof item.id === 'string' && item.id ? item.id : `touchstone-${index}`,
        name,
        description: typeof item.description === 'string' ? item.description : undefined,
        status,
      })
      return result
    }, [])
    : []
  return { chronicleTenets, convictions, touchstones }
}
