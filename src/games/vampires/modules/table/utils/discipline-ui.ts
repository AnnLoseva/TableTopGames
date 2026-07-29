import { findCrossLanguageName, getAttributeDots } from '@/games/vampires/lib/i18n/ruleNames'
import type { DisciplineCost } from '@/games/vampires/core/vtm5/rules/disciplines/costs'
import type {
  DisciplinePowerInputField,
  DisciplinePowerMechanics,
} from '@/games/vampires/core/vtm5/rules/disciplines/schema'
import type { DisciplineCostMechanics } from '@/games/vampires/core/vtm5/rules/disciplines/costs'
import { ATTRIBUTE_GROUPS, SKILL_GROUPS } from '../constants'
import { tableDisciplines } from '../system-runtime'
import type { CharacterOption } from '../types'
import { formatRuleValue } from './display'

export type DisciplinePowerRule = {
  description?: string
  pool?: string
  roll?: string
  extra_roll?: string
  control_roll?: string
  resistance?: string
  difficulty?: string | number
  difficulty_for_victim?: string | number
  soak_difficulty?: string | number
  cost?: string
  mechanics?: DisciplinePowerMechanics & DisciplineCostMechanics & {
    humanity?: {
      risk?: boolean
      suggestedStains?: number
      requiresStorytellerConfirm?: boolean
      reason?: string
    }
  }
  effect?: string
  duration?: string
}

export type DisciplineRule = {
  description?: string
  system?: Record<string, unknown>
  powers?: Record<string, Record<string, DisciplinePowerRule>>
  paths?: Record<string, {
    description?: string
    powers?: Record<string, Record<string, DisciplinePowerRule>>
  }>
}

export type DisciplinePowerEntry = {
  level: number
  name: string
  path?: string
  rule: DisciplinePowerRule
}

export type PowerPoolChoice = {
  source: string
  options: string[]
}

const ATTRIBUTE_NAMES = ATTRIBUTE_GROUPS.flatMap(group => [...group.traits])
const SKILL_NAMES = SKILL_GROUPS.flatMap(group => [...group.traits])

export function getDefaultDisciplineRules(rulesJson: unknown): Record<string, DisciplineRule> {
  return (rulesJson as { disciplines?: Record<string, DisciplineRule> }).disciplines || {}
}

export function getDisciplineCostLabel(
  cost: DisciplineCost,
  legacyCost?: string,
  t: (ru: string) => string = ru => ru,
  tf: (ru: string, vars: Record<string, string | number>) => string = (ru, vars) =>
    Object.entries(vars).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), ru),
) {
  if (legacyCost?.trim()) return legacyCost
  const parts = [
    cost.rouseChecks > 0
      ? tf('{n} испытание Крови', { n: cost.rouseChecks })
      : '',
    cost.bloodPoints > 0
      ? tf('{n} пункт крови', { n: cost.bloodPoints })
      : '',
    cost.willpowerSpend > 0
      ? tf('{n} пункт Воли', { n: cost.willpowerSpend })
      : '',
  ].filter(Boolean)
  return parts.join(' + ') || t('нет')
}

export function getSkillDotValue(value: unknown) {
  if (typeof value === 'number') return value
  if (!value || typeof value !== 'object') return 0
  return Number((value as { dots?: number }).dots || 0)
}

export function getCharacterPoolPartDots(character: CharacterOption, name: string) {
  const attributeName = findCrossLanguageName(name, Object.keys(character.attributes))
  if (attributeName) return getAttributeDots(character.attributes, attributeName)
  const skillName = findCrossLanguageName(name, Object.keys(character.skills))
  if (skillName) return getSkillDotValue(character.skills[skillName])
  const disciplineName = findCrossLanguageName(name, Object.keys(character.disciplines))
  if (disciplineName) {
    return Object.values(character.disciplines[disciplineName] || {})
      .reduce((sum, value) => sum + (Number(value) || 0), 0)
  }
  return 0
}

export function getDisciplinePowerEntries(rule?: DisciplineRule): DisciplinePowerEntry[] {
  if (!rule) return []
  const directPowers: DisciplinePowerEntry[] = Object.entries(rule.powers || {})
    .flatMap(([level, powers]) => Object.entries(powers || {}).map(([name, powerRule]) => ({
      level: Number(level) || 0,
      name,
      path: undefined,
      rule: powerRule,
    })))
  const pathPowers: DisciplinePowerEntry[] = Object.entries(rule.paths || {})
    .flatMap(([pathName, path]) => Object.entries(path.powers || {})
      .flatMap(([level, powers]) => Object.entries(powers || {}).map(([name, powerRule]) => ({
        level: Number(level) || 0,
        name,
        path: pathName,
        rule: powerRule,
      }))))
  return [...directPowers, ...pathPowers]
    .sort((a, b) =>
      a.level - b.level
      || (a.path || '').localeCompare(b.path || '', 'ru')
      || a.name.localeCompare(b.name, 'ru'))
}

export function getDisciplinePowerEntryKey(power: Pick<DisciplinePowerEntry, 'name' | 'path'>) {
  return power.path ? `${power.path} / ${power.name}` : power.name
}

export function resolvePowerPool(pool: string, rules: Record<string, DisciplineRule>) {
  const trimmed = pool.trim()
  const reference = trimmed.match(/^(?:как|as)\s+(.+)$/i)?.[1]?.trim()
  const normalizedReference = reference?.toLocaleLowerCase('ru')
  if (!reference || normalizedReference === 'применяемая сила' || normalizedReference === 'the power being applied') {
    return trimmed
  }
  for (const discipline of Object.values(rules)) {
    const referencedPower = getDisciplinePowerEntries(discipline)
      .find(power => power.name.toLocaleLowerCase('ru') === reference.toLocaleLowerCase('ru'))
    if (referencedPower?.rule.pool) return referencedPower.rule.pool
  }
  return trimmed
}

function getMechanicsRollRecord(rule?: DisciplinePowerRule | null) {
  const roll = rule?.mechanics?.roll
  return roll && typeof roll === 'object' && !Array.isArray(roll)
    ? roll as Record<string, unknown>
    : null
}

function formatMechanicsPool(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' + ')
  return typeof value === 'string' ? value : ''
}

export function getPowerRollFormula(rule?: DisciplinePowerRule | null) {
  const mechanicsRoll = getMechanicsRollRecord(rule)
  return rule?.pool
    || rule?.roll
    || formatMechanicsPool(mechanicsRoll?.actorPool)
    || ''
}

export function getPowerRollSummary(
  rule: DisciplinePowerRule | null | undefined,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  const rows = [
    getPowerRollFormula(rule),
    rule?.extra_roll ? tf('Дополнительно: {value}', { value: rule.extra_roll }) : '',
    rule?.control_roll ? tf('Контроль: {value}', { value: rule.control_roll }) : '',
    rule?.resistance ? tf('Сопротивление: {value}', { value: rule.resistance }) : '',
  ].filter(Boolean)
  return rows.join(' · ')
}

export function getPowerDifficultySummary(
  rule: DisciplinePowerRule | null | undefined,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  const mechanicsRoll = getMechanicsRollRecord(rule)
  const rows = [
    rule?.difficulty ? formatRuleValue(rule.difficulty) : '',
    !rule?.difficulty && mechanicsRoll?.difficulty
      ? formatRuleValue(mechanicsRoll.difficulty)
      : '',
    rule?.difficulty_for_victim ? tf('для цели: {value}', { value: formatRuleValue(rule.difficulty_for_victim) }) : '',
    rule?.soak_difficulty ? tf('прочность: {value}', { value: formatRuleValue(rule.soak_difficulty) }) : '',
  ].filter(Boolean)
  return rows.join(' · ')
}

export function parsePowerPool(pool: string, disciplineNames: string[]) {
  const normalizedPool = pool.trim()
  if (!normalizedPool || normalizedPool === '—' || /^(зависит|как применяемая|depends|as\s)/i.test(normalizedPool)) {
    return []
  }
  const playerSide = normalizedPool.split(/\s+(?:vs\.?|против)\s+/i)[0].split(';')[0].replace(/\s*\([^)]*\)\s*/g, '').trim()
  if (!playerSide) return []
  const knownNames = [...ATTRIBUTE_NAMES, ...SKILL_NAMES, ...disciplineNames]

  const choices = playerSide.split(/\s*\+\s*/).map(source => {
    const options = source
      .split(/\s+(?:или|or)\s+|\//i)
      .map(option => findCrossLanguageName(option, knownNames))
      .filter(Boolean)
    return { source: source.trim(), options } as PowerPoolChoice
  })
  return choices.every(choice => choice.options.length > 0) ? choices : []
}

export function getSelectedPowerNames(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map(power => {
      if (typeof power === 'string') return power
      if (!power || typeof power !== 'object') return ''
      const record = power as Record<string, unknown>
      return String(record.name || record['название'] || '')
    })
    .filter(Boolean)
}

export function getSelectedPathPowerNames(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([pathName, powers]) => {
      const names = getSelectedPowerNames(powers)
      return names.length ? [[pathName, names]] : []
    }),
  ) as Record<string, string[]>
}

export function getSelectedPathPowerLabels(value: unknown) {
  return Object.entries(getSelectedPathPowerNames(value))
    .flatMap(([pathName, powers]) => powers.map(power => `${pathName} / ${power}`))
}

function getPathPowerNameSet(value: unknown) {
  return new Set(Object.values(getSelectedPathPowerNames(value)).flat())
}

export function getStandaloneSelectedPowerNames(
  selectedPowers: unknown,
  selectedPathPowers: unknown,
) {
  const pathPowerNames = getPathPowerNameSet(selectedPathPowers)
  return getSelectedPowerNames(selectedPowers)
    .filter(name => !pathPowerNames.has(name))
}

export function getSelectedDisciplinePowerLabels(
  selectedPowers: unknown,
  selectedPathPowers: unknown,
) {
  return [
    ...getStandaloneSelectedPowerNames(selectedPowers, selectedPathPowers),
    ...getSelectedPathPowerLabels(selectedPathPowers),
  ]
}

export function hasSelectedPathPowers(value: unknown) {
  return getSelectedPathPowerLabels(value).length > 0
}

export function isPowerEntrySelected(
  power: DisciplinePowerEntry,
  selectedPowerNames: string[],
  selectedPathPowers: Record<string, string[]>,
) {
  if (selectedPowerNames.includes(power.name)) return true
  return Boolean(power.path && selectedPathPowers[power.path]?.includes(power.name))
}

export function getDisciplinePowerDots(
  character: CharacterOption,
  disciplineName: string,
  pathName?: string,
) {
  const sources = character.disciplines[disciplineName] || {}
  if (pathName && Number(sources[pathName]) > 0) {
    return Number(sources[pathName]) || 0
  }
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

export function getActiveEffectTitle(
  activeEffect: CharacterOption['activeEffects'][number],
) {
  return activeEffect.effect.label
    || activeEffect.source.power
    || activeEffect.effect.type
}

function getPayloadValueLabel(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const payloadLabels: Record<string, string> = {
    commandText: 'команда',
    memoryGap: 'провал',
    falseMemory: 'ложная память',
    triggerText: 'триггер',
    groupTarget: 'группа',
    disguiseText: 'маскировка',
    objectText: 'объект',
    senseTarget: 'цель',
    questionText: 'вопрос',
    telepathyMessage: 'мысль',
    possessionTarget: 'носитель',
    areaText: 'место',
    famulusName: 'фамулус',
    animalSpecies: 'вид',
    animalCommand: 'приказ',
    swarmTarget: 'цель роя',
    frenzyTarget: 'цель ярости',
    feedingSource: 'питание',
    targetName: 'цель',
    bloodSample: 'образец крови',
    weaponName: 'оружие',
    deliveryMethod: 'способ',
    ritualTarget: 'цель ритуала',
    ritualComponents: 'компоненты',
    alchemyMethod: 'метод',
    alchemyFormula: 'формула',
    formulaTarget: 'цель формулы',
    alchemyResonance: 'резонанс',
    alchemyIngredients: 'ингредиенты',
    imitatedDiscipline: 'дисциплина',
    imitatedPower: 'сила',
  }
  const label = payloadLabels[key] || key
  return `${label}: ${String(value)}`
}

export function getActiveEffectPayloadDescription(
  activeEffect: CharacterOption['activeEffects'][number],
) {
  const payload = activeEffect.effect.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ''
  }

  return Object.entries(payload)
    .map(([key, value]) => getPayloadValueLabel(key, value))
    .filter(Boolean)
    .join(' · ')
}

export function getActiveEffectDescription(
  activeEffect: CharacterOption['activeEffects'][number],
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  return [
    activeEffect.effect.description,
    getActiveEffectPayloadDescription(activeEffect),
    activeEffect.source.path,
    activeEffect.source.level
      ? tf('уровень {level}', { level: activeEffect.source.level })
      : '',
    tableDisciplines().getDisciplineDurationLabel(activeEffect.duration, t, tf),
  ].filter(Boolean).join(' · ')
}

export function getDisciplinePowerInputFields(
  mechanics: DisciplinePowerRule['mechanics'] | undefined,
): DisciplinePowerInputField[] {
  const fields = mechanics?.input?.fields
  if (!Array.isArray(fields)) return []

  return fields.flatMap(field => {
    if (!field || typeof field !== 'object' || typeof field.id !== 'string' || !field.id.trim()) {
      return []
    }
    return [{
      ...field,
      id: field.id.trim(),
      type: field.type || 'text',
    }]
  })
}

export function getDisciplineManualPrompts(
  mechanics: DisciplinePowerRule['mechanics'] | undefined,
) {
  const effects = mechanics?.effects
  if (!Array.isArray(effects)) return []

  return effects.flatMap(effect => {
    if (!effect || typeof effect !== 'object') return []
    const record = effect as Record<string, unknown>
    if (record.type !== 'manual_prompt') return []
    const label = typeof record.label === 'string' ? record.label : ''
    const description = typeof record.description === 'string' ? record.description : ''
    const message = typeof record.message === 'string' ? record.message : ''
    if (!label && !description && !message) return []
    return [{ label, description, message }]
  })
}

