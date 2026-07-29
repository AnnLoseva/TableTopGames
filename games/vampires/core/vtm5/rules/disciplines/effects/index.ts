import { getAttributeDots } from '@/games/vampires/lib/i18n/ruleNames'
import { getActiveEffects } from '../active-effects'
import {
  normalizeCharacterDisciplines,
  type NormalizedCharacterDisciplines,
} from '../character-disciplines'
import {
  loadDisciplineRules,
  type LoadedDisciplinePower,
  type LoadedDisciplineRules,
} from '../rules-loader'
import {
  getDamageSeverityLabel,
  normalizeDamageAmount,
  type AppliedDisciplineDamageModifier,
  type DisciplineDamageContext,
  type DisciplineDamageModifierOperation,
  type DisciplineDamageOwner,
  type DisciplineDamageResult,
  type DisciplineDamageStage,
} from '../../damage'
import type {
  ActiveEffect,
  DamageMatcher,
  DamageModifierEffect,
  DisciplineEffect,
  FeedingMatcher,
  FeedingModifierEffect,
  RollMatcher,
  RollModifierEffect,
} from '../schema'

type JsonObject = Record<string, unknown>

export type PassiveTrackerModifier = {
  tracker: 'health' | 'willpower'
  operation: 'add_max'
  value: number
  source: {
    discipline: string
    power: string
    path?: string
    level: number
  }
}

export type DisciplineRollPenalty = {
  id: string
  label: string
  diceDelta: number
  kind?: string
}

export type DisciplineRollEffectContext = {
  characterData: unknown
  rulesJson?: unknown
  baseDiceCount: number
  poolType?: string
  kind?: string
  action?: string
  source?: string
  traits?: string[]
  weaponTags?: string[]
  conditions?: string[]
  penalties?: DisciplineRollPenalty[]
  disabledModifierIds?: string[]
}

export type AppliedDisciplineRollModifier = {
  id: string
  sourceKind: 'active' | 'passive' | 'penalty'
  operation: 'add_dice' | 'remove_dice' | 'difficulty_modifier' | 'ignore_penalty' | 'auto_success'
  label: string
  sourceLabel: string
  discipline?: string
  power?: string
  path?: string
  level?: number
  diceDelta: number
  difficultyDelta: number
  ignoredPenaltyIds?: string[]
  active: boolean
  canDisable: boolean
}

export type DisciplineRollEffectResult = {
  baseDiceCount: number
  finalDiceCount: number
  diceDelta: number
  difficultyDelta: number
  autoSuccess: boolean
  autoSuccessLabels: string[]
  modifiers: AppliedDisciplineRollModifier[]
  ignoredPenaltyIds: string[]
}

type RollModifierCandidate = {
  id: string
  sourceKind: 'active' | 'passive'
  source: {
    discipline: string
    power: string
    path?: string
    level?: number
  }
  effect: RollModifierEffect
}

type DamageModifierCandidate = {
  id: string
  sourceKind: 'active' | 'passive'
  owner: DisciplineDamageOwner
  data: JsonObject
  normalized: NormalizedCharacterDisciplines
  source: {
    discipline: string
    power: string
    path?: string
    level?: number
  }
  effect: DamageModifierEffect
}

export type DisciplineFeedingContext = {
  characterData: unknown
  rulesJson?: unknown
  hungerBefore: number
  baseSatiation: number
  source?: string
  conditions?: string[]
  disabledModifierIds?: string[]
}

export type AppliedDisciplineFeedingModifier = {
  id: string
  sourceKind: 'active' | 'passive'
  operation: 'add_satiation' | 'set_satiation'
  label: string
  sourceLabel: string
  discipline?: string
  power?: string
  path?: string
  level?: number
  satiationDelta: number
  beforeSatiation: number
  afterSatiation: number
  minimumHunger?: number
  active: boolean
  canDisable: boolean
}

export type DisciplineFeedingEffectResult = {
  hungerBefore: number
  hungerAfter: number
  baseSatiation: number
  finalSatiation: number
  minimumHunger: number
  modifiers: AppliedDisciplineFeedingModifier[]
  chain: string[]
}

type FeedingModifierCandidate = {
  id: string
  sourceKind: 'active' | 'passive'
  data: JsonObject
  normalized: NormalizedCharacterDisciplines
  source: {
    discipline: string
    power: string
    path?: string
    level?: number
  }
  effect: FeedingModifierEffect
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getCharacterData(characterData: unknown): JsonObject {
  if (!isObject(characterData)) return {}
  return isObject(characterData.data) ? characterData.data : characterData
}

function getDisciplineRating(
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  return Object.values(normalized.disciplines[disciplineName] || {})
    .reduce((total, value) => total + (Number(value) || 0), 0)
}

function isPassiveActivation(mechanics: JsonObject) {
  const activation = mechanics.activation
  if (typeof activation === 'string') {
    return activation === 'passive'
  }
  if (!isObject(activation)) return false
  return activation.passive === true
    || activation.type === 'passive'
    || activation.mode === 'passive'
    || activation.kind === 'passive'
}

function resolveTraitValue(
  trait: string,
  characterData: JsonObject,
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  const normalizedTrait = trait.trim().toLocaleLowerCase('ru')
  if (
    normalizedTrait === 'discipline'
    || normalizedTrait === 'discipline_rating'
    || normalizedTrait === disciplineName.toLocaleLowerCase('ru')
  ) {
    return getDisciplineRating(normalized, disciplineName)
  }

  const attributes = isObject(characterData.attributes)
    ? characterData.attributes
    : {}
  const attributeValue = getAttributeDots(attributes, trait)
  if (attributeValue > 0 || Object.prototype.hasOwnProperty.call(attributes, trait)) {
    return attributeValue
  }

  return getDisciplineRating(normalized, trait)
}

function applyFormulaBounds(value: number, formula: JsonObject) {
  const multiplier = Number(formula.multiplier)
  const offset = Number(formula.offset)
  const min = Number(formula.min)
  const max = Number(formula.max)
  let result = value

  if (Number.isFinite(multiplier)) result *= multiplier
  if (Number.isFinite(offset)) result += offset
  if (Number.isFinite(min)) result = Math.max(min, result)
  if (Number.isFinite(max)) result = Math.min(max, result)
  return result
}

function resolveFormulaValue(
  value: unknown,
  characterData: JsonObject,
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  if (value === undefined) {
    return getDisciplineRating(normalized, disciplineName)
  }

  if (typeof value === 'number') return value

  if (typeof value === 'string') {
    const number = Number(value)
    if (Number.isFinite(number)) return number
    return resolveTraitValue(value, characterData, normalized, disciplineName)
  }

  if (!isObject(value)) return 0

  if (value.formula === 'discipline_rating') {
    const formulaDiscipline = typeof value.discipline === 'string'
      ? value.discipline
      : disciplineName
    return applyFormulaBounds(
      getDisciplineRating(normalized, formulaDiscipline),
      value,
    )
  }

  if (value.type === 'trait' && typeof value.trait === 'string') {
    return applyFormulaBounds(
      resolveTraitValue(
        value.trait,
        characterData,
        normalized,
        disciplineName,
      ),
      value,
    )
  }

  if (value.type === 'formula' && typeof value.expression === 'string') {
    const expression = value.expression.trim()
    const number = Number(expression)
    if (Number.isFinite(number)) return number
    return resolveTraitValue(
      expression,
      characterData,
      normalized,
      disciplineName,
    )
  }

  return 0
}

function normalizeText(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLocaleLowerCase('ru')
    : ''
}

function hasMatcherValues(
  expected: string[] | undefined,
  actual: Array<string | undefined>,
) {
  if (!expected || expected.length === 0) return true
  const actualSet = new Set(actual.map(normalizeText).filter(Boolean))
  return expected.some((value) => actualSet.has(normalizeText(value)))
}

function matchesRollMatcher(
  matcher: RollMatcher | undefined,
  context: DisciplineRollEffectContext,
) {
  if (!matcher) return true
  return hasMatcherValues(matcher.poolTypes, [context.poolType])
    && hasMatcherValues(matcher.kinds, [context.kind])
    && hasMatcherValues(matcher.actions, [context.action])
    && hasMatcherValues(matcher.sources, [context.source])
    && hasMatcherValues(matcher.traits, context.traits || [])
    && hasMatcherValues(matcher.weaponTags, context.weaponTags || [])
    && hasMatcherValues(matcher.conditions, context.conditions || [])
}

function isRollModifierEffect(effect: DisciplineEffect | unknown): effect is RollModifierEffect {
  return isObject(effect) && effect.type === 'roll_modifier'
}

function normalizeRollOperation(
  effect: RollModifierEffect,
): AppliedDisciplineRollModifier['operation'] {
  if (effect.operation === 'remove_dice' || effect.operation === 'subtract') {
    return 'remove_dice'
  }
  if (effect.operation === 'difficulty_modifier') return 'difficulty_modifier'
  if (effect.operation === 'ignore_penalty') return 'ignore_penalty'
  if (effect.operation === 'auto_success') return 'auto_success'
  return 'add_dice'
}

function getRollEffectAmount(
  effect: RollModifierEffect,
  data: JsonObject,
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  return resolveFormulaValue(
    effect.value ?? effect.amount,
    data,
    normalized,
    disciplineName,
  )
}

function getEffectSourceLabel(candidate: RollModifierCandidate) {
  return candidate.effect.label
    || candidate.source.power
    || candidate.source.discipline
}

function getPenaltyMatcherValues(effect: RollModifierEffect) {
  const values = [
    effect.penalty,
    ...(Array.isArray(effect.penalties) ? effect.penalties : []),
    typeof effect.value === 'string' ? effect.value : '',
  ]
  return values.map(normalizeText).filter(Boolean)
}

function getIgnoredPenaltyIds(
  effect: RollModifierEffect,
  penalties: DisciplineRollPenalty[],
) {
  const matcherValues = getPenaltyMatcherValues(effect)
  if (matcherValues.length === 0) return penalties.map((penalty) => penalty.id)

  return penalties
    .filter((penalty) => {
      const values = [
        penalty.id,
        penalty.kind,
        penalty.label,
      ].map(normalizeText)
      return matcherValues.some((matcherValue) => values.includes(matcherValue))
    })
    .map((penalty) => penalty.id)
}

function createRollModifierApplication(
  candidate: RollModifierCandidate,
  operation: AppliedDisciplineRollModifier['operation'],
  active: boolean,
  diceDelta = 0,
  difficultyDelta = 0,
  ignoredPenaltyIds: string[] = [],
): AppliedDisciplineRollModifier {
  return {
    id: candidate.id,
    sourceKind: candidate.sourceKind,
    operation,
    label: candidate.effect.label || candidate.source.power,
    sourceLabel: getEffectSourceLabel(candidate),
    discipline: candidate.source.discipline,
    power: candidate.source.power,
    path: candidate.source.path,
    level: candidate.source.level,
    diceDelta,
    difficultyDelta,
    ignoredPenaltyIds,
    active,
    canDisable: true,
  }
}

function matchesDamageMatcher(
  matcher: DamageMatcher | undefined,
  context: DisciplineDamageContext,
  owner?: DisciplineDamageOwner,
) {
  if (!matcher) return true
  return hasMatcherValues(matcher.owners, [owner])
    && hasMatcherValues(matcher.targets, [context.target || 'health'])
    && hasMatcherValues(matcher.severities, [context.severity])
    && hasMatcherValues(matcher.sources, [context.source])
    && hasMatcherValues(matcher.attackTypes, [
      context.attackType,
      ...(context.attackTypes || []),
    ])
    && hasMatcherValues(matcher.weaponTags, context.weaponTags || [])
    && hasMatcherValues(matcher.creatureTypes, [context.creatureType])
    && hasMatcherValues(matcher.conditions, context.conditions || [])
}

function isDamageModifierEffect(effect: DisciplineEffect | unknown): effect is DamageModifierEffect {
  return isObject(effect) && effect.type === 'damage_modifier'
}

function matchesFeedingMatcher(
  matcher: FeedingMatcher | undefined,
  context: DisciplineFeedingContext,
) {
  if (!matcher) return true
  return hasMatcherValues(matcher.sources, [context.source])
    && hasMatcherValues(matcher.conditions, context.conditions || [])
}

function isFeedingModifierEffect(effect: DisciplineEffect | unknown): effect is FeedingModifierEffect {
  return isObject(effect) && effect.type === 'feeding_modifier'
}

function getFeedingEffectAmount(candidate: FeedingModifierCandidate) {
  return resolveFormulaValue(
    candidate.effect.value ?? candidate.effect.amount,
    candidate.data,
    candidate.normalized,
    candidate.source.discipline,
  )
}

function getFeedingEffectSourceLabel(candidate: FeedingModifierCandidate) {
  return candidate.effect.label
    || candidate.source.power
    || candidate.source.discipline
}

function normalizeFeedingOperation(
  effect: FeedingModifierEffect,
): AppliedDisciplineFeedingModifier['operation'] {
  return effect.operation === 'set_satiation'
    ? 'set_satiation'
    : 'add_satiation'
}

function getDamageStage(effect: DamageModifierEffect): DisciplineDamageStage {
  return effect.timing === 'after_halving' || effect.stage === 'after_halving'
    ? 'after_halving'
    : 'before_halving'
}

function normalizeDamageOperation(
  effect: DamageModifierEffect,
): DisciplineDamageModifierOperation {
  if (effect.operation === 'prevent_first_attack' || effect.preventFirstAttack) {
    return 'prevent_first_attack'
  }
  if (effect.operation === 'prevent_damage') {
    return 'prevent_damage'
  }
  if (effect.operation === 'ignore_halving' || effect.ignoreHalving) {
    return 'ignore_halving'
  }
  if (effect.operation === 'ignore_armor' || effect.ignoreArmor) {
    return 'ignore_armor'
  }
  if (effect.operation === 'convert_damage_type' || effect.setSeverity || effect.severity) {
    return 'convert_damage_type'
  }
  if (effect.operation === 'set_damage' || effect.operation === 'set') {
    return 'set_damage'
  }
  if (effect.operation === 'subtract_before_halving') return 'subtract_before_halving'
  if (effect.operation === 'subtract_after_halving') return 'subtract_after_halving'
  if (effect.operation === 'subtract') {
    return getDamageStage(effect) === 'after_halving'
      ? 'subtract_after_halving'
      : 'subtract_before_halving'
  }
  return 'add_damage'
}

function getDamageEffectAmount(candidate: DamageModifierCandidate) {
  return resolveFormulaValue(
    candidate.effect.value ?? candidate.effect.amount,
    candidate.data,
    candidate.normalized,
    candidate.source.discipline,
  )
}

function getDamageEffectSourceLabel(candidate: DamageModifierCandidate) {
  return candidate.effect.label
    || candidate.source.power
    || candidate.source.discipline
}

function createDamageModifierApplication({
  candidate,
  operation,
  active,
  amountDelta = 0,
  beforeAmount,
  afterAmount,
  beforeSeverity,
  afterSeverity,
}: {
  candidate: DamageModifierCandidate
  operation: DisciplineDamageModifierOperation
  active: boolean
  amountDelta?: number
  beforeAmount: number
  afterAmount: number
  beforeSeverity: DisciplineDamageResult['severity']
  afterSeverity: DisciplineDamageResult['severity']
}): AppliedDisciplineDamageModifier {
  return {
    id: candidate.id,
    sourceKind: candidate.sourceKind,
    owner: candidate.owner,
    operation,
    label: candidate.effect.label || candidate.source.power,
    sourceLabel: getDamageEffectSourceLabel(candidate),
    discipline: candidate.source.discipline,
    power: candidate.source.power,
    path: candidate.source.path,
    level: candidate.source.level,
    amountDelta,
    beforeAmount,
    afterAmount,
    beforeSeverity,
    afterSeverity,
    active,
    canDisable: true,
  }
}

function getDamageModifierChainLine(
  modifier: AppliedDisciplineDamageModifier,
) {
  if (modifier.operation === 'prevent_first_attack') {
    return `${modifier.sourceLabel}: атака предотвращена`
  }
  if (modifier.operation === 'prevent_damage') {
    return `${modifier.sourceLabel}: урон предотвращён`
  }
  if (modifier.operation === 'ignore_halving') {
    return `${modifier.sourceLabel}: лёгкий урон не делится пополам`
  }
  if (modifier.operation === 'ignore_armor') {
    if (modifier.amountDelta < 0) {
      return `${modifier.sourceLabel}: броня ${modifier.amountDelta}`
    }
    return `${modifier.sourceLabel}: броня игнорируется`
  }
  if (modifier.operation === 'convert_damage_type') {
    return `${modifier.sourceLabel}: ${getDamageSeverityLabel(modifier.beforeSeverity)} урон → ${getDamageSeverityLabel(modifier.afterSeverity)}`
  }
  const prefix = modifier.amountDelta > 0 ? '+' : ''
  if (modifier.operation === 'set_damage') {
    return `${modifier.sourceLabel}: урон ${modifier.afterAmount}`
  }
  const timing = modifier.operation === 'subtract_before_halving'
    ? ' до деления'
    : modifier.operation === 'subtract_after_halving'
      ? ' после деления'
      : ''
  return `${modifier.sourceLabel}: ${prefix}${modifier.amountDelta}${timing}`
}

function getSeverityFromDamageEffect(
  effect: DamageModifierEffect,
  fallback: DisciplineDamageResult['severity'],
) {
  if (effect.setSeverity === 'superficial' || effect.setSeverity === 'aggravated') {
    return effect.setSeverity
  }
  if (effect.severity === 'superficial' || effect.severity === 'aggravated') {
    return effect.severity
  }
  const rawValue = effect.value as unknown
  if (rawValue === 'superficial' || rawValue === 'aggravated') {
    return rawValue
  }
  return fallback
}

function getLearnedPowers(
  disciplineName: string,
  rules: LoadedDisciplineRules,
  normalized: NormalizedCharacterDisciplines,
) {
  const discipline = rules[disciplineName]
  if (!discipline) return []

  const selectedPathPowers = normalized.pathPowers[disciplineName] || {}
  const selectedPathPowerNames = new Set(Object.values(selectedPathPowers).flat())
  const selectedPowerNames = (normalized.powers[disciplineName] || [])
    .filter((powerName) => !selectedPathPowerNames.has(powerName))
  const hasSelectedPathPowers = Object.values(selectedPathPowers).some(
    (powers) => powers.length > 0,
  )
  if (selectedPowerNames.length > 0 || hasSelectedPathPowers) {
    const selected = new Set(selectedPowerNames)
    return discipline.powers.filter((power) => {
      if (selected.has(power.name)) return true
      if (!power.path) return false
      return selectedPathPowers[power.path]?.includes(power.name) || false
    })
  }

  const disciplineRating = getDisciplineRating(normalized, disciplineName)
  const sources = normalized.disciplines[disciplineName] || {}
  return discipline.powers.filter((power) => {
    const pathRating = power.path && Number(sources[power.path]) > 0
      ? Number(sources[power.path])
      : disciplineRating
    return power.level <= pathRating
  })
}

function getPassivePowerEffects(power: LoadedDisciplinePower) {
  const mechanics = isObject(power.raw.mechanics)
    ? power.raw.mechanics
    : null
  if (!mechanics || !isObject(mechanics.automation)) return []
  if (
    mechanics.automation.status !== 'auto'
    && mechanics.automation.status !== 'partial'
  ) return []
  if (!isPassiveActivation(mechanics)) return []
  return Array.isArray(mechanics.effects) ? mechanics.effects : []
}

function getPassiveRollModifierCandidates(
  data: JsonObject,
  rulesJson: unknown,
  normalized: NormalizedCharacterDisciplines,
): RollModifierCandidate[] {
  const rules = loadDisciplineRules(rulesJson)
  const candidates: RollModifierCandidate[] = []

  for (const disciplineName of Object.keys(normalized.disciplines)) {
    const learnedPowers = getLearnedPowers(
      disciplineName,
      rules,
      normalized,
    )

    for (const power of learnedPowers) {
      getPassivePowerEffects(power).forEach((effect, index) => {
        if (!isRollModifierEffect(effect)) return
        candidates.push({
          id: `passive:${disciplineName}:${power.path || ''}:${power.name}:${effect.id || index}`,
          sourceKind: 'passive',
          source: {
            discipline: disciplineName,
            power: power.name,
            path: power.path,
            level: power.level,
          },
          effect,
        })
      })
    }
  }

  return candidates
}

function getActiveRollModifierCandidates(
  characterData: unknown,
): RollModifierCandidate[] {
  return getActiveEffects(characterData)
    .filter((activeEffect: ActiveEffect) => activeEffect.active)
    .filter((activeEffect) => isRollModifierEffect(activeEffect.effect))
    .map((activeEffect) => ({
      id: `active:${activeEffect.id}`,
      sourceKind: 'active',
      source: activeEffect.source,
      effect: activeEffect.effect as RollModifierEffect,
    }))
}

function getPassiveDamageModifierCandidates(
  data: JsonObject,
  rulesJson: unknown,
  normalized: NormalizedCharacterDisciplines,
  owner: DisciplineDamageOwner,
): DamageModifierCandidate[] {
  const rules = loadDisciplineRules(rulesJson)
  const candidates: DamageModifierCandidate[] = []

  for (const disciplineName of Object.keys(normalized.disciplines)) {
    const learnedPowers = getLearnedPowers(
      disciplineName,
      rules,
      normalized,
    )

    for (const power of learnedPowers) {
      getPassivePowerEffects(power).forEach((effect, index) => {
        if (!isDamageModifierEffect(effect)) return
        candidates.push({
          id: `${owner}:passive:${disciplineName}:${power.path || ''}:${power.name}:${effect.id || index}`,
          sourceKind: 'passive',
          owner,
          data,
          normalized,
          source: {
            discipline: disciplineName,
            power: power.name,
            path: power.path,
            level: power.level,
          },
          effect,
        })
      })
    }
  }

  return candidates
}

function getActiveDamageModifierCandidates(
  characterData: unknown,
  owner: DisciplineDamageOwner,
): DamageModifierCandidate[] {
  const data = getCharacterData(characterData)
  const normalized = normalizeCharacterDisciplines(data)
  return getActiveEffects(characterData)
    .filter((activeEffect: ActiveEffect) => activeEffect.active)
    .filter((activeEffect) => isDamageModifierEffect(activeEffect.effect))
    .map((activeEffect) => ({
      id: `${owner}:active:${activeEffect.id}`,
      sourceKind: 'active',
      owner,
      data,
      normalized,
      source: activeEffect.source,
      effect: activeEffect.effect as DamageModifierEffect,
    }))
}

function getPassiveFeedingModifierCandidates(
  data: JsonObject,
  rulesJson: unknown,
  normalized: NormalizedCharacterDisciplines,
): FeedingModifierCandidate[] {
  const rules = loadDisciplineRules(rulesJson)
  const candidates: FeedingModifierCandidate[] = []

  for (const disciplineName of Object.keys(normalized.disciplines)) {
    const learnedPowers = getLearnedPowers(
      disciplineName,
      rules,
      normalized,
    )

    for (const power of learnedPowers) {
      getPassivePowerEffects(power).forEach((effect, index) => {
        if (!isFeedingModifierEffect(effect)) return
        candidates.push({
          id: `passive:${disciplineName}:${power.path || ''}:${power.name}:${effect.id || index}`,
          sourceKind: 'passive',
          data,
          normalized,
          source: {
            discipline: disciplineName,
            power: power.name,
            path: power.path,
            level: power.level,
          },
          effect,
        })
      })
    }
  }

  return candidates
}

function getActiveFeedingModifierCandidates(
  characterData: unknown,
): FeedingModifierCandidate[] {
  const data = getCharacterData(characterData)
  const normalized = normalizeCharacterDisciplines(data)
  return getActiveEffects(characterData)
    .filter((activeEffect: ActiveEffect) => activeEffect.active)
    .filter((activeEffect) => isFeedingModifierEffect(activeEffect.effect))
    .map((activeEffect) => ({
      id: `active:${activeEffect.id}`,
      sourceKind: 'active',
      data,
      normalized,
      source: activeEffect.source,
      effect: activeEffect.effect as FeedingModifierEffect,
    }))
}

function getFeedingModifierCandidates(
  feedingContext: DisciplineFeedingContext,
) {
  const data = getCharacterData(feedingContext.characterData)
  const normalized = normalizeCharacterDisciplines(data)
  return [
    ...getPassiveFeedingModifierCandidates(
      data,
      feedingContext.rulesJson,
      normalized,
    ),
    ...getActiveFeedingModifierCandidates(data),
  ]
}

function getDamageModifierCandidates(
  damageContext: DisciplineDamageContext,
) {
  const targetData = getCharacterData(
    damageContext.targetCharacterData ?? damageContext.characterData,
  )
  const sourceData = getCharacterData(damageContext.sourceCharacterData)
  const targetNormalized = normalizeCharacterDisciplines(targetData)
  const sourceNormalized = normalizeCharacterDisciplines(sourceData)
  const candidates = [
    ...getPassiveDamageModifierCandidates(
      targetData,
      damageContext.rulesJson,
      targetNormalized,
      'target',
    ),
    ...getActiveDamageModifierCandidates(
      damageContext.targetCharacterData ?? damageContext.characterData,
      'target',
    ),
  ]

  if (Object.keys(sourceData).length > 0) {
    candidates.push(
      ...getPassiveDamageModifierCandidates(
        sourceData,
        damageContext.rulesJson,
        sourceNormalized,
        'source',
      ),
      ...getActiveDamageModifierCandidates(
        damageContext.sourceCharacterData,
        'source',
      ),
    )
  }

  return candidates
}

export function getPassiveTrackerModifiers(
  characterData: unknown,
  rulesJson: unknown,
): PassiveTrackerModifier[] {
  const data = getCharacterData(characterData)
  const normalized = normalizeCharacterDisciplines(data)
  const rules = loadDisciplineRules(rulesJson)
  const modifiers: PassiveTrackerModifier[] = []

  for (const disciplineName of Object.keys(normalized.disciplines)) {
    const learnedPowers = getLearnedPowers(
      disciplineName,
      rules,
      normalized,
    )

    for (const power of learnedPowers) {
      for (const effect of getPassivePowerEffects(power)) {
        if (!isObject(effect) || effect.type !== 'tracker_modifier') continue
        if (effect.operation !== 'add_max') continue
        if (effect.tracker !== 'health' && effect.tracker !== 'willpower') {
          continue
        }

        const value = resolveFormulaValue(
          effect.value ?? effect.amount,
          data,
          normalized,
          disciplineName,
        )
        if (!Number.isFinite(value) || value === 0) continue

        modifiers.push({
          tracker: effect.tracker,
          operation: 'add_max',
          value,
          source: {
            discipline: disciplineName,
            power: power.name,
            path: power.path,
            level: power.level,
          },
        })
      }
    }
  }

  return modifiers
}

export function applyDisciplineEffectsToRoll(
  rollContext: DisciplineRollEffectContext,
  _derivedStats?: unknown,
): DisciplineRollEffectResult {
  const data = getCharacterData(rollContext.characterData)
  const normalized = normalizeCharacterDisciplines(data)
  const penalties = rollContext.penalties || []
  const disabled = new Set(rollContext.disabledModifierIds || [])
  const candidates = [
    ...getPassiveRollModifierCandidates(
      data,
      rollContext.rulesJson,
      normalized,
    ),
    ...getActiveRollModifierCandidates(data),
  ]

  const modifiers: AppliedDisciplineRollModifier[] = []
  const ignoredPenaltyIds = new Set<string>()

  for (const candidate of candidates) {
    const operation = normalizeRollOperation(candidate.effect)
    if (operation !== 'ignore_penalty') continue
    if (!matchesRollMatcher(candidate.effect.matcher, rollContext)) continue

    const ignoredByEffect = getIgnoredPenaltyIds(candidate.effect, penalties)
    const isActive = !disabled.has(candidate.id)
    if (isActive) {
      ignoredByEffect.forEach((id) => ignoredPenaltyIds.add(id))
    }
    modifiers.push(createRollModifierApplication(
      candidate,
      operation,
      isActive,
      0,
      0,
      ignoredByEffect,
    ))
  }

  for (const penalty of penalties) {
    const active = !ignoredPenaltyIds.has(penalty.id)
    modifiers.push({
      id: `penalty:${penalty.id}`,
      sourceKind: 'penalty',
      operation: penalty.diceDelta < 0 ? 'remove_dice' : 'add_dice',
      label: penalty.label,
      sourceLabel: penalty.label,
      diceDelta: penalty.diceDelta,
      difficultyDelta: 0,
      active,
      canDisable: false,
    })
  }

  for (const candidate of candidates) {
    const operation = normalizeRollOperation(candidate.effect)
    if (operation === 'ignore_penalty') continue
    if (!matchesRollMatcher(candidate.effect.matcher, rollContext)) continue

    if (operation === 'auto_success') {
      modifiers.push(createRollModifierApplication(
        candidate,
        operation,
        !disabled.has(candidate.id),
      ))
      continue
    }

    const amount = getRollEffectAmount(
      candidate.effect,
      data,
      normalized,
      candidate.source.discipline,
    )
    if (!Number.isFinite(amount) || amount === 0) continue

    const active = !disabled.has(candidate.id)
    const diceDelta = operation === 'add_dice'
      ? Math.floor(Math.abs(amount))
      : operation === 'remove_dice'
        ? -Math.floor(Math.abs(amount))
        : 0
    const difficultyDelta = operation === 'difficulty_modifier'
      ? Math.floor(amount)
      : 0

    modifiers.push(createRollModifierApplication(
      candidate,
      operation,
      active,
      diceDelta,
      difficultyDelta,
    ))
  }

  const activeModifiers = modifiers.filter((modifier) => modifier.active)
  const diceDelta = activeModifiers.reduce(
    (total, modifier) => total + modifier.diceDelta,
    0,
  )
  const difficultyDelta = activeModifiers.reduce(
    (total, modifier) => total + modifier.difficultyDelta,
    0,
  )
  const autoSuccessLabels = activeModifiers
    .filter((modifier) => modifier.operation === 'auto_success')
    .map((modifier) => modifier.sourceLabel)
  const baseDiceCount = Math.max(
    0,
    Math.floor(Number(rollContext.baseDiceCount) || 0),
  )
  const finalDiceCount = Math.max(
    0,
    Math.min(20, baseDiceCount + diceDelta),
  )

  return {
    baseDiceCount,
    finalDiceCount,
    diceDelta,
    difficultyDelta,
    autoSuccess: autoSuccessLabels.length > 0,
    autoSuccessLabels,
    modifiers,
    ignoredPenaltyIds: [...ignoredPenaltyIds],
  }
}

export function applyDisciplineEffectsToFeeding(
  feedingContext: DisciplineFeedingContext,
): DisciplineFeedingEffectResult {
  const disabled = new Set(feedingContext.disabledModifierIds || [])
  const hungerBefore = Math.max(
    0,
    Math.min(5, Math.floor(Number(feedingContext.hungerBefore) || 0)),
  )
  const baseSatiation = Math.max(
    0,
    Math.floor(Number(feedingContext.baseSatiation) || 0),
  )
  let currentSatiation = baseSatiation
  let minimumHunger = 0
  const modifiers: AppliedDisciplineFeedingModifier[] = []
  const chain = [`Утоление Голода ${baseSatiation}`]

  for (const candidate of getFeedingModifierCandidates(feedingContext)) {
    if (!matchesFeedingMatcher(candidate.effect.matcher, feedingContext)) {
      continue
    }

    const operation = normalizeFeedingOperation(candidate.effect)
    const rawAmount = getFeedingEffectAmount(candidate)
    if (!Number.isFinite(rawAmount)) continue
    const amount = Math.max(0, Math.floor(Math.abs(rawAmount)))
    const active = !disabled.has(candidate.id)
    const beforeSatiation = currentSatiation
    const afterSatiation = active
      ? operation === 'set_satiation'
        ? amount
        : beforeSatiation + amount
      : beforeSatiation
    const minimumHungerValue = Number(candidate.effect.minimumHunger)
    const normalizedMinimumHunger = Number.isFinite(minimumHungerValue)
      ? Math.max(0, Math.min(5, Math.floor(minimumHungerValue)))
      : undefined
    const modifier: AppliedDisciplineFeedingModifier = {
      id: candidate.id,
      sourceKind: candidate.sourceKind,
      operation,
      label: candidate.effect.label || candidate.source.power,
      sourceLabel: getFeedingEffectSourceLabel(candidate),
      discipline: candidate.source.discipline,
      power: candidate.source.power,
      path: candidate.source.path,
      level: candidate.source.level,
      satiationDelta: afterSatiation - beforeSatiation,
      beforeSatiation,
      afterSatiation,
      minimumHunger: normalizedMinimumHunger,
      active,
      canDisable: true,
    }
    modifiers.push(modifier)

    if (active) {
      currentSatiation = afterSatiation
      if (normalizedMinimumHunger !== undefined) {
        minimumHunger = Math.max(minimumHunger, normalizedMinimumHunger)
      }
      const deltaPrefix = modifier.satiationDelta > 0 ? '+' : ''
      const minimumText = normalizedMinimumHunger !== undefined
        ? `, минимум Голода ${normalizedMinimumHunger}`
        : ''
      chain.push(`${modifier.sourceLabel}: ${deltaPrefix}${modifier.satiationDelta}${minimumText}`)
    }
  }

  const hungerAfter = Math.max(
    minimumHunger,
    Math.min(5, hungerBefore - currentSatiation),
  )

  return {
    hungerBefore,
    hungerAfter,
    baseSatiation,
    finalSatiation: currentSatiation,
    minimumHunger,
    modifiers,
    chain,
  }
}

export function applyDisciplineEffectsToDamage(
  damageContext: DisciplineDamageContext,
  _derivedStats?: unknown,
): DisciplineDamageResult {
  const disabled = new Set(damageContext.disabledModifierIds || [])
  const originalAmount = normalizeDamageAmount(damageContext.baseAmount)
  const originalSeverity = damageContext.severity
  let currentAmount = originalAmount
  let currentSeverity = originalSeverity
  const armorValue = normalizeDamageAmount(damageContext.armor)
  const chain = [
    `Урон ${originalAmount} ${getDamageSeverityLabel(originalSeverity)}`,
  ]
  const modifiers: AppliedDisciplineDamageModifier[] = []
  const candidates = getDamageModifierCandidates(damageContext)
    .filter((candidate) => matchesDamageMatcher(
      candidate.effect.matcher,
      damageContext,
      candidate.owner,
    ))

  const pushModifier = (
    candidate: DamageModifierCandidate,
    operation: DisciplineDamageModifierOperation,
    active: boolean,
    amountDelta = 0,
    beforeAmount = currentAmount,
    afterAmount = currentAmount,
    beforeSeverity = currentSeverity,
    afterSeverity = currentSeverity,
  ) => {
    const modifier = createDamageModifierApplication({
      candidate,
      operation,
      active,
      amountDelta,
      beforeAmount,
      afterAmount,
      beforeSeverity,
      afterSeverity,
    })
    modifiers.push(modifier)
    if (active) chain.push(getDamageModifierChainLine(modifier))
    return modifier
  }

  for (const candidate of candidates) {
    const operation = normalizeDamageOperation(candidate.effect)
    if (operation !== 'prevent_first_attack' && operation !== 'prevent_damage') continue
    const active = !disabled.has(candidate.id)
    pushModifier(
      candidate,
      operation,
      active,
      -currentAmount,
      currentAmount,
      active ? 0 : currentAmount,
    )
    if (active) {
      return {
        originalAmount,
        originalSeverity,
        amountBeforeHalving: 0,
        finalAmount: 0,
        severity: currentSeverity,
        halved: false,
        prevented: true,
        armorIgnored: false,
        armorValue,
        modifiers,
        chain: [...chain, 'Осталось 0'],
      }
    }
  }

  let armorIgnored = false
  let ignoredArmorAmount = 0
  for (const candidate of candidates) {
    const operation = normalizeDamageOperation(candidate.effect)
    if (operation !== 'ignore_armor') continue
    const active = !disabled.has(candidate.id)
    const beforeArmor = Math.max(0, armorValue - ignoredArmorAmount)
    const hasLimitedArmorIgnore = candidate.effect.value !== undefined
      || candidate.effect.amount !== undefined
    const rawAmount = hasLimitedArmorIgnore
      ? getDamageEffectAmount(candidate)
      : armorValue
    const ignoredByEffect = Number.isFinite(rawAmount)
      ? Math.min(beforeArmor, Math.floor(Math.abs(rawAmount)))
      : 0
    const afterArmor = active ? Math.max(0, beforeArmor - ignoredByEffect) : beforeArmor
    pushModifier(
      candidate,
      operation,
      active,
      -ignoredByEffect,
      beforeArmor,
      afterArmor,
    )
    if (active) {
      ignoredArmorAmount += ignoredByEffect
    }
  }
  const effectiveArmorValue = Math.max(0, armorValue - ignoredArmorAmount)
  armorIgnored = armorValue > 0 && effectiveArmorValue === 0

  const applyAmountModifier = (
    candidate: DamageModifierCandidate,
    operation: DisciplineDamageModifierOperation,
  ) => {
    const rawAmount = getDamageEffectAmount(candidate)
    if (!Number.isFinite(rawAmount) || rawAmount === 0) return

    const active = !disabled.has(candidate.id)
    const beforeAmount = currentAmount
    const amount = Math.floor(Math.abs(rawAmount))
    const amountDelta = operation === 'set_damage'
      ? amount - beforeAmount
      : operation === 'add_damage'
        ? amount
        : -amount
    const afterAmount = active
      ? operation === 'set_damage'
        ? amount
        : Math.max(0, beforeAmount + amountDelta)
      : beforeAmount
    pushModifier(
      candidate,
      operation,
      active,
      amountDelta,
      beforeAmount,
      afterAmount,
    )
    if (active) currentAmount = afterAmount
  }

  for (const candidate of candidates) {
    const operation = normalizeDamageOperation(candidate.effect)
    const stage = getDamageStage(candidate.effect)
    if (operation === 'subtract_before_halving') {
      applyAmountModifier(candidate, operation)
    }
    if (operation === 'add_damage' && stage === 'before_halving') {
      applyAmountModifier(candidate, operation)
    }
    if (operation === 'set_damage' && stage === 'before_halving') {
      applyAmountModifier(candidate, operation)
    }
  }

  if (effectiveArmorValue > 0) {
    const beforeAmount = currentAmount
    currentAmount = Math.max(0, currentAmount - effectiveArmorValue)
    const modifier: AppliedDisciplineDamageModifier = {
      id: 'armor',
      sourceKind: 'armor',
      operation: 'subtract_before_halving',
      label: 'Броня',
      sourceLabel: 'Броня',
      amountDelta: -effectiveArmorValue,
      beforeAmount,
      afterAmount: currentAmount,
      beforeSeverity: currentSeverity,
      afterSeverity: currentSeverity,
      active: true,
      canDisable: false,
    }
    modifiers.push(modifier)
    chain.push(getDamageModifierChainLine(modifier))
  }

  for (const candidate of candidates) {
    const operation = normalizeDamageOperation(candidate.effect)
    if (operation !== 'convert_damage_type') continue
    const active = !disabled.has(candidate.id)
    const beforeSeverity = currentSeverity
    const afterSeverity = active
      ? getSeverityFromDamageEffect(candidate.effect, currentSeverity)
      : currentSeverity
    pushModifier(
      candidate,
      operation,
      active,
      0,
      currentAmount,
      currentAmount,
      beforeSeverity,
      afterSeverity,
    )
    if (active) currentSeverity = afterSeverity
  }

  const amountBeforeHalving = currentAmount
  if (currentAmount !== originalAmount) {
    chain.push(`Осталось ${currentAmount}`)
  }

  let halvingIgnored = false
  for (const candidate of candidates) {
    const operation = normalizeDamageOperation(candidate.effect)
    if (operation !== 'ignore_halving') continue
    const active = !disabled.has(candidate.id)
    pushModifier(candidate, operation, active)
    if (active) halvingIgnored = true
  }

  const halved = currentSeverity === 'superficial'
    && damageContext.halveSuperficial !== false
    && !halvingIgnored
  if (halved) {
    currentAmount = Math.ceil(currentAmount / 2)
    chain.push(`Деление лёгкого урона: ${currentAmount}`)
  }

  for (const candidate of candidates) {
    const operation = normalizeDamageOperation(candidate.effect)
    const stage = getDamageStage(candidate.effect)
    if (operation === 'subtract_after_halving') {
      applyAmountModifier(candidate, operation)
    }
    if (operation === 'add_damage' && stage === 'after_halving') {
      applyAmountModifier(candidate, operation)
    }
    if (operation === 'set_damage' && stage === 'after_halving') {
      applyAmountModifier(candidate, operation)
    }
  }

  return {
    originalAmount,
    originalSeverity,
    amountBeforeHalving,
    finalAmount: currentAmount,
    severity: currentSeverity,
    halved,
    prevented: false,
    armorIgnored,
    armorValue,
    modifiers,
    chain,
  }
}
