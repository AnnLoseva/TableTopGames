export type DamageSeverity = 'superficial' | 'aggravated'
export type DamageTarget = 'health' | 'willpower'
export type CreatureType = 'vampire' | 'mortal' | 'ghoul' | 'thinblood' | 'other'
export type DamageProfile = 'vampire' | 'mortal' | 'ghoul' | 'thinblood' | 'custom'
export type PhysicalState = 'healthy' | 'impaired' | 'torpor' | 'dead_or_coma' | 'dead' | null

export type HealthTracker = {
  superficial: number
  aggravated: number
  bonusMax?: number
  maxOverride?: number | null
}

export type NormalizedHealth = {
  superficial: number
  aggravated: number
  bonusMax: number
  maxOverride: number | null
  max: number
  current: number
  impaired: boolean
  defeated: boolean
  physicalState: PhysicalState
}

export type HealthDamageOptions = {
  source?: 'manual' | 'physical_conflict' | 'discipline' | 'fire' | 'sunlight' | 'weapon' | 'fall' | 'other'
  sourceCharacterData?: unknown
  attackType?: string
  weaponTags?: string[]
  armor?: number
  halveSuperficial?: boolean
  ignoreHalving?: boolean
  weaponModifier?: number
  margin?: number
  notes?: string[]
}

export type HealthDamageResult = {
  tracker: NormalizedHealth
  originalAmount: number
  finalAmount: number
  applied: number
  converted: number
  halved: boolean
  warnings: string[]
}

// character.attributes is keyed by whichever rules language was active when that
// character was saved, independent of the table's current display language.
const PHYSICAL_ATTRIBUTES = ['Сила', 'Ловкость', 'Выносливость', 'Strength', 'Dexterity', 'Stamina']
const SUPERFICIAL_MEND_BY_BLOOD_POTENCY = [1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 5]

function clampInteger(value: unknown, min: number, max: number) {
  const number = Math.floor(Number(value) || 0)
  return Math.max(min, Math.min(max, number))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function getHealthMax(stamina: unknown, tracker?: Partial<HealthTracker> | null) {
  const bonusMax = Math.max(0, Math.floor(Number(tracker?.bonusMax) || 0))
  const derivedMax = Math.max(0, Math.floor(Number(stamina) || 0) + 3 + bonusMax)
  const override = tracker?.maxOverride
  return override === null || override === undefined
    ? derivedMax
    : Math.max(0, Math.floor(Number(override) || 0))
}

export function normalizeDamageProfile(
  value: unknown,
  clan?: string | null,
  type?: string | null,
): DamageProfile {
  if (value === 'vampire' || value === 'mortal' || value === 'ghoul' || value === 'thinblood' || value === 'custom') {
    return value
  }
  const identity = `${clan || ''} ${type || ''}`.toLocaleLowerCase('ru')
  if (/слабокров|thin.?blood/.test(identity)) return 'thinblood'
  if (/гул|ghoul/.test(identity)) return 'ghoul'
  if (/mortal|смертн|npc-mortal/.test(identity)) return 'mortal'
  return 'vampire'
}

export function getPhysicalState(
  superficial: number,
  aggravated: number,
  max: number,
  profile: DamageProfile,
): PhysicalState {
  if (max > 0 && aggravated >= max) {
    if (profile === 'vampire') return 'torpor'
    if (profile === 'mortal' || profile === 'ghoul') return 'dead_or_coma'
    return null
  }
  if (max > 0 && superficial + aggravated >= max) return 'impaired'
  return 'healthy'
}

export function normalizeHealthTracker(
  value: unknown,
  stamina: unknown,
  profile: DamageProfile = 'vampire',
): NormalizedHealth {
  if (typeof value === 'number') {
    const max = getHealthMax(stamina)
    const legacyCurrent = clampInteger(value, 0, max)
    const superficial = max - legacyCurrent
    return {
      superficial,
      aggravated: 0,
      bonusMax: 0,
      maxOverride: null,
      max,
      current: legacyCurrent,
      impaired: max > 0 && legacyCurrent <= 0,
      defeated: false,
      physicalState: getPhysicalState(superficial, 0, max, profile),
    }
  }

  const source = isRecord(value) ? value : {}
  const bonusMax = Math.max(0, Math.floor(Number(source.bonusMax) || 0))
  const maxOverride = source.maxOverride === null || source.maxOverride === undefined
    ? null
    : Math.max(0, Math.floor(Number(source.maxOverride) || 0))
  const max = getHealthMax(stamina, { bonusMax, maxOverride })
  const aggravated = clampInteger(source.aggravated, 0, max)
  const superficial = clampInteger(source.superficial, 0, Math.max(0, max - aggravated))
  const current = Math.max(0, max - superficial - aggravated)
  const physicalState = getPhysicalState(superficial, aggravated, max, profile)

  return {
    superficial,
    aggravated,
    bonusMax,
    maxOverride,
    max,
    current,
    impaired: max > 0 && current <= 0,
    defeated: max > 0 && aggravated >= max,
    physicalState,
  }
}

export function toHealthTracker(health: NormalizedHealth): HealthTracker {
  return {
    superficial: health.superficial,
    aggravated: health.aggravated,
    bonusMax: health.bonusMax,
    maxOverride: health.maxOverride ?? null,
  }
}

export function getHealthMetaState(health: NormalizedHealth) {
  return {
    max: health.max,
    superficial: health.superficial,
    aggravated: health.aggravated,
    current: health.current,
    impaired: health.impaired,
    physicalState: health.physicalState,
  }
}

const identityT = (ru: string) => ru
const basicTf = (ru: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), ru)

export function getHealthWarning(
  health: NormalizedHealth,
  profile: DamageProfile,
  t: (ru: string) => string = identityT,
) {
  if (health.aggravated >= health.max && health.max > 0) {
    if (profile === 'vampire') return t('Шкала здоровья полностью заполнена тяжёлыми повреждениями: вампир впадает в торпор.')
    if (profile === 'mortal' || profile === 'ghoul') return t('Шкала здоровья полностью заполнена тяжёлыми повреждениями: смертный в коме или мёртв, решение Рассказчика.')
    if (profile === 'thinblood') return t('Слабокровный: проверь профиль урона и решение Рассказчика.')
    return t('Шкала здоровья полностью заполнена тяжёлыми повреждениями: решение Рассказчика.')
  }
  if (health.impaired) return t('Шкала здоровья заполнена: физические проверки получают -2к10.')
  return ''
}

export function applyHealthDamage(
  health: NormalizedHealth,
  amount: number,
  severity: DamageSeverity,
  options: HealthDamageOptions = {},
  profile: DamageProfile = 'vampire',
  t: (ru: string) => string = identityT,
  tf: (ru: string, vars: Record<string, string | number>) => string = basicTf,
): HealthDamageResult {
  const originalAmount = Math.max(0, Math.floor(Number(amount) || 0))
  const halved = severity === 'superficial'
    && options.halveSuperficial !== false
    && !options.ignoreHalving
  const finalAmount = halved ? Math.ceil(originalAmount / 2) : originalAmount
  let superficial = health.superficial
  let aggravated = health.aggravated
  let applied = 0
  let converted = 0
  const warnings = [...(options.notes || [])]

  for (let index = 0; index < finalAmount; index += 1) {
    if (aggravated >= health.max) break
    if (superficial + aggravated < health.max) {
      if (severity === 'aggravated') aggravated += 1
      else superficial += 1
      applied += 1
      continue
    }
    if (superficial > 0) {
      superficial -= 1
      aggravated += 1
      applied += 1
      converted += 1
      continue
    }
    break
  }

  const tracker = normalizeHealthTracker({
    superficial,
    aggravated,
    bonusMax: health.bonusMax,
    maxOverride: health.maxOverride,
  }, health.max - 3 - health.bonusMax, profile)
  if (converted > 0) warnings.push(tf('Переполнение шкалы: {converted} лёгк. поврежд. превращено в тяжёлые.', { converted }))
  const warning = getHealthWarning(tracker, profile, t)
  if (warning) warnings.push(warning)

  return { tracker, originalAmount, finalAmount, applied, converted, halved, warnings }
}

export function recoverHealthDamage(
  health: NormalizedHealth,
  amount: number,
  severity: DamageSeverity,
  profile: DamageProfile,
) {
  const requested = Math.max(0, Math.floor(Number(amount) || 0))
  const recovered = Math.min(requested, severity === 'aggravated' ? health.aggravated : health.superficial)
  const tracker = normalizeHealthTracker({
    superficial: health.superficial - (severity === 'superficial' ? recovered : 0),
    aggravated: health.aggravated - (severity === 'aggravated' ? recovered : 0),
    bonusMax: health.bonusMax,
    maxOverride: health.maxOverride,
  }, health.max - 3 - health.bonusMax, profile)
  return { tracker, recovered }
}

export function convertMortalAggravatedDamage(
  health: NormalizedHealth,
  healerMedicine: number,
  success: boolean,
  profile: DamageProfile,
) {
  const converted = success
    ? Math.min(health.aggravated, Math.ceil(Math.max(0, Number(healerMedicine) || 0) / 2))
    : 0
  const tracker = normalizeHealthTracker({
    superficial: health.superficial + converted,
    aggravated: health.aggravated - converted,
    bonusMax: health.bonusMax,
    maxOverride: health.maxOverride,
  }, health.max - 3 - health.bonusMax, profile)
  return { tracker, converted }
}

export function getHealthImpairmentPenalty(parts: string[], health?: NormalizedHealth | null) {
  if (!health?.impaired) return 0
  return parts.some(part => PHYSICAL_ATTRIBUTES.includes(part)) ? -2 : 0
}

export function getSuperficialMendAmount(bloodPotency: number) {
  const potency = clampInteger(bloodPotency, 0, 10)
  return SUPERFICIAL_MEND_BY_BLOOD_POTENCY[potency] || 1
}

export function calculateConflictDamage({
  margin,
  weaponModifier = 0,
}: {
  margin: number
  weaponModifier?: number
}) {
  return Math.max(0, Math.floor(Number(margin) || 0) + Math.floor(Number(weaponModifier) || 0))
}
