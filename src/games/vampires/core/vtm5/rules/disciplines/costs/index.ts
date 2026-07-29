import { parseLegacyDisciplineCost } from '../legacy-cost-parser'

type JsonObject = Record<string, unknown>

export type DisciplineCost = {
  rouseChecks: number
  bloodPoints: number
  willpowerSpend: number
  willpowerRatingReduction: number
  variableRouseChecks: boolean
  variableBloodPoints: boolean
  manualBlood: boolean
  manualWillpower: boolean
  warnings: string[]
  source: 'mechanics' | 'legacy' | 'none'
}

export type DisciplineCostMechanics = JsonObject & {
  cost?: {
    rouseChecks?: number
    bloodPoints?: number
    willpowerSpend?: number
    willpowerRatingReduction?: number
    variableRouseChecks?: boolean
    variableBloodPoints?: boolean
    manualBlood?: boolean
    manualWillpower?: boolean
  }
  rouse_checks?: number
  variable_rouse_checks?: boolean
  willpower_cost?: number | {
    spend?: number
    reduce_rating?: number
    manual_choice?: boolean
  }
}

export type DisciplineCostSource = JsonObject & {
  mechanics?: DisciplineCostMechanics
  cost?: DisciplineCostMechanics['cost'] | string
  legacyCost?: unknown
}

export type DisciplineCostWillpower = {
  max: number
  superficial: number
  aggravated: number
  current: number
  impaired: boolean
}

export type DisciplineCostCharacter = {
  characterType?: string
  vitalTrackers?: {
    hunger?: number
    willpower?: unknown
    [tracker: string]: unknown
  }
  willpower?: Partial<DisciplineCostWillpower>
  derivedStats?: {
    willpower?: {
      totalMax?: number
    }
  }
}

export type DisciplineCostRouseCheck = {
  id: string
  reason: string
  value: number
  success: boolean
  hungerBefore: number
  hungerAfter: number
  maxHungerWarning: boolean
}

export type PayDisciplineCostOptions = {
  random?: () => number
  makeId?: () => string
  reason?: string
  rouseChecksOverride?: number
  t?: (ru: string) => string
  tf?: (ru: string, vars: Record<string, string | number>) => string
}

export type DisciplineCostPayment<TCharacter> = {
  success: boolean
  error?: 'insufficient_willpower' | 'manual_cost'
  character: TCharacter
  cost: DisciplineCost
  hungerBefore: number
  hungerAfter: number
  willpowerBefore: DisciplineCostWillpower
  willpowerAfter: DisciplineCostWillpower
  spentWillpower: number
  rouseChecks: DisciplineCostRouseCheck[]
  warnings: string[]
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function toCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
}

function hasOwn(value: JsonObject, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function getMechanicsSource(source: DisciplineCostSource) {
  return isObject(source.mechanics)
    ? source.mechanics as DisciplineCostMechanics
    : source
}

export function resolveDisciplineCost(
  source: DisciplineCostSource = {},
): DisciplineCost {
  const mechanics = getMechanicsSource(source)
  const explicitCost = isObject(mechanics.cost) ? mechanics.cost : null

  if (explicitCost && hasOwn(mechanics, 'cost')) {
    const bloodPoints = toCount(explicitCost.bloodPoints)
    const manualBlood = bloodPoints > 0 || Boolean(explicitCost.manualBlood)
    const willpowerRatingReduction = toCount(explicitCost.willpowerRatingReduction)
    const manualWillpower = willpowerRatingReduction > 0 || Boolean(explicitCost.manualWillpower)
    const warnings = [
      ...(manualBlood
        ? ['Стоимость в пунктах крови отмечена для старой редакции и списывается вручную: трек Голода не меняется автоматически.']
        : []),
      ...(willpowerRatingReduction > 0
        ? ['Стоимость похожа на снижение рейтинга или максимума Воли и требует ручного решения Рассказчика.']
        : []),
      ...(manualWillpower && willpowerRatingReduction === 0
        ? ['В тексте указана ручная или зависящая от цели трата Воли; автоматически она не списывается.']
        : []),
    ]
    return {
      rouseChecks: toCount(explicitCost.rouseChecks),
      bloodPoints,
      willpowerSpend: toCount(explicitCost.willpowerSpend),
      willpowerRatingReduction,
      variableRouseChecks: Boolean(explicitCost.variableRouseChecks),
      variableBloodPoints: Boolean(explicitCost.variableBloodPoints),
      manualBlood,
      manualWillpower,
      warnings,
      source: 'mechanics',
    }
  }

  const legacyValue = typeof source.cost === 'string'
    ? source.cost
    : source.legacyCost
  const parsed = parseLegacyDisciplineCost(legacyValue)
  let rouseChecks = parsed.rouseChecks
  let bloodPoints = 0
  let willpowerSpend = parsed.willpowerSpend
  let willpowerRatingReduction = parsed.willpowerRatingReduction
  let variableRouseChecks = parsed.variableRouseChecks
  let variableBloodPoints = false
  let manualBlood = false
  let manualWillpower = parsed.manualWillpower
  const warnings = [...parsed.warnings]
  let hasMachineCost = false

  if (toCount(mechanics.rouse_checks) > 0) {
    rouseChecks = toCount(mechanics.rouse_checks)
    variableRouseChecks = Boolean(mechanics.variable_rouse_checks)
    hasMachineCost = true
  }

  const legacyWillpower = mechanics.willpower_cost
  if (typeof legacyWillpower === 'number' && toCount(legacyWillpower) > 0) {
    willpowerSpend = toCount(legacyWillpower)
    manualWillpower = false
    hasMachineCost = true
  } else if (isObject(legacyWillpower)) {
    const spend = toCount(legacyWillpower.spend)
    const reduceRating = toCount(legacyWillpower.reduce_rating)
    if (spend > 0) willpowerSpend = spend
    manualWillpower = Boolean(legacyWillpower.manual_choice)
    if (reduceRating > 0) {
      warnings.push('Стоимость похожа на снижение рейтинга или максимума Воли и требует ручного решения Рассказчика.')
      willpowerSpend = 0
      willpowerRatingReduction = reduceRating
      manualWillpower = true
    }
    hasMachineCost = spend > 0 || reduceRating > 0 || manualWillpower
  }

  const hasLegacyCost = rouseChecks > 0
    || bloodPoints > 0
    || willpowerSpend > 0
    || willpowerRatingReduction > 0
    || variableRouseChecks
    || variableBloodPoints
    || manualBlood
    || manualWillpower
    || warnings.length > 0

  return {
    rouseChecks,
    bloodPoints,
    willpowerSpend,
    willpowerRatingReduction,
    variableRouseChecks,
    variableBloodPoints,
    manualBlood,
    manualWillpower,
    warnings,
    source: hasMachineCost ? 'mechanics' : hasLegacyCost ? 'legacy' : 'none',
  }
}

function normalizeWillpower(
  character: DisciplineCostCharacter,
): DisciplineCostWillpower {
  const source = isObject(character.willpower) ? character.willpower : {}
  const max = toCount(
    source.max
    ?? character.derivedStats?.willpower?.totalMax
    ?? 0,
  )
  const aggravated = Math.min(max, toCount(source.aggravated))
  const superficial = Math.min(
    Math.max(0, max - aggravated),
    toCount(source.superficial),
  )
  const current = Math.max(0, max - superficial - aggravated)
  return {
    max,
    superficial,
    aggravated,
    current,
    impaired: max > 0 && current <= 0,
  }
}

function spendWillpower(
  willpower: DisciplineCostWillpower,
  amount: number,
) {
  const next = {
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
  }
  let spent = 0
  const warnings: string[] = []

  for (let index = 0; index < amount; index += 1) {
    if (next.aggravated >= willpower.max) break
    if (next.superficial + next.aggravated < willpower.max) {
      next.superficial += 1
      spent += 1
      continue
    }
    if (next.superficial > 0) {
      next.superficial -= 1
      next.aggravated += 1
      spent += 1
      warnings.push('Трек Воли был заполнен: один поверхностный стресс превращён в тяжёлый.')
    }
  }

  const current = Math.max(0, willpower.max - next.superficial - next.aggravated)
  return {
    tracker: {
      max: willpower.max,
      superficial: next.superficial,
      aggravated: next.aggravated,
      current,
      impaired: willpower.max > 0 && current <= 0,
    },
    spent,
    warnings,
  }
}

function rollD10(random: () => number) {
  const value = Number(random())
  const normalized = Number.isFinite(value)
    ? Math.max(0, Math.min(0.999999, value))
    : 0
  return Math.floor(normalized * 10) + 1
}

export function payDisciplineCost<TCharacter extends DisciplineCostCharacter>(
  character: TCharacter,
  mechanics: DisciplineCostSource = {},
  options: PayDisciplineCostOptions = {},
): DisciplineCostPayment<TCharacter> {
  const cost = resolveDisciplineCost(mechanics)
  const hungerBefore = Math.max(
    0,
    Math.min(5, toCount(character.vitalTrackers?.hunger)),
  )
  const willpowerBefore = normalizeWillpower(character)
  const automaticWillpowerSpend = cost.manualWillpower
    ? 0
    : cost.willpowerSpend

  if (cost.willpowerRatingReduction > 0) {
    return {
      success: false,
      error: 'manual_cost',
      character,
      cost,
      hungerBefore,
      hungerAfter: hungerBefore,
      willpowerBefore,
      willpowerAfter: willpowerBefore,
      spentWillpower: 0,
      rouseChecks: [],
      warnings: cost.warnings,
    }
  }
  const willpowerPayment = spendWillpower(
    willpowerBefore,
    automaticWillpowerSpend,
  )

  if (willpowerPayment.spent < automaticWillpowerSpend) {
    return {
      success: false,
      error: 'insufficient_willpower',
      character,
      cost,
      hungerBefore,
      hungerAfter: hungerBefore,
      willpowerBefore,
      willpowerAfter: willpowerBefore,
      spentWillpower: 0,
      rouseChecks: [],
      warnings: [
        ...cost.warnings,
        'Воля полностью заполнена тяжёлым стрессом: оплатить силу нельзя.',
      ],
    }
  }

  const checksCount = options.rouseChecksOverride === undefined
    ? cost.rouseChecks
    : Math.max(0, Math.min(10, toCount(options.rouseChecksOverride)))
  const random = options.random || Math.random
  const makeId = options.makeId
    || (() => `${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const t = options.t || ((ru: string) => ru)
  const tf = options.tf || ((ru: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), ru))
  const reason = options.reason || t('Активация силы')
  const rouseChecks: DisciplineCostRouseCheck[] = []
  let hungerAfter = hungerBefore

  for (let index = 0; index < checksCount; index += 1) {
    const hungerAtRoll = hungerAfter
    const value = rollD10(random)
    const success = value >= 6
    hungerAfter = success
      ? hungerAtRoll
      : Math.min(5, hungerAtRoll + 1)
    rouseChecks.push({
      id: makeId(),
      reason: checksCount > 1
        ? tf('{reason} · Испытание Крови {index}/{total}', { reason, index: index + 1, total: checksCount })
        : tf('{reason} · Испытание Крови', { reason }),
      value,
      success,
      hungerBefore: hungerAtRoll,
      hungerAfter,
      maxHungerWarning: !success && hungerAtRoll >= 5,
    })
  }

  const willpowerAfter = willpowerPayment.tracker
  const nextCharacter = {
    ...character,
    willpower: {
      ...(character.willpower || {}),
      ...willpowerAfter,
    },
    vitalTrackers: {
      ...(character.vitalTrackers || {}),
      hunger: hungerAfter,
      willpower: {
        superficial: willpowerAfter.superficial,
        aggravated: willpowerAfter.aggravated,
      },
    },
  } as TCharacter

  return {
    success: true,
    character: nextCharacter,
    cost,
    hungerBefore,
    hungerAfter,
    willpowerBefore,
    willpowerAfter,
    spentWillpower: willpowerPayment.spent,
    rouseChecks,
    warnings: [
      ...cost.warnings,
      ...willpowerPayment.warnings,
      ...(willpowerAfter.impaired && willpowerPayment.spent > 0
        ? ['Трек Воли заполнен: ментальные и социальные проверки получают -2к10.']
        : []),
    ],
  }
}
