import { getAttributeDots } from '@/games/vampires/lib/i18n/ruleNames'
import { getDefaultDamageProfile, normalizeWillpowerTracker } from '../mappers'
import { tableHealth } from '../system-runtime'
import type {
  CharacterOption,
  NormalizedHealth,
  NormalizedWillpower,
  RollMeta,
} from '../types'

const WILLPOWER_IMPAIRED_ATTRIBUTES = [
  'Обаяние',
  'Манипуляция',
  'Самообладание',
  'Интеллект',
  'Смекалка',
  'Упорство',
]

export function getCharacterHunger(character?: CharacterOption | null) {
  if (character && !['vampire', 'thinblood'].includes(character.characterType)) return 0
  return Math.max(0, Math.min(5, Number(character?.vitalTrackers?.hunger || 0) || 0))
}

export function getCharacterBloodPotency(character?: CharacterOption | null) {
  if (character && !['vampire', 'thinblood'].includes(character.characterType)) return 0
  return Math.max(0, Math.min(10, Number(character?.bloodPotency || 0) || 0))
}

export function getCharacterWillpower(character?: CharacterOption | null): NormalizedWillpower {
  if (!character) return { superficial: 0, aggravated: 0, max: 0, current: 0, impaired: false }
  return character.willpower || normalizeWillpowerTracker(
    character.vitalTrackers?.willpower,
    character.derivedStats.willpower.totalMax,
  )
}

export function getCharacterDamageProfile(character?: CharacterOption | null): NonNullable<CharacterOption['damageProfile']> {
  return character?.damageProfile || getDefaultDamageProfile(character?.characterType || 'vampire')
}

export function getCharacterHealth(character?: CharacterOption | null): NormalizedHealth {
  if (!character) {
    return {
      superficial: 0,
      aggravated: 0,
      bonusMax: 0,
      maxOverride: null,
      max: 0,
      current: 0,
      impaired: false,
      defeated: false,
      physicalState: 'healthy',
    }
  }
  return character.health || tableHealth().normalizeHealthTracker(
    character.vitalTrackers?.health,
    getAttributeDots(character.attributes, 'Выносливость')
      + character.derivedStats.health.passiveBonus,
    getCharacterDamageProfile(character),
  )
}

export function getCharacterHealthStamina(character: CharacterOption) {
  return getAttributeDots(character.attributes, 'Выносливость')
    + character.derivedStats.health.passiveBonus
}

export function getWillpowerMetaState(willpower: NormalizedWillpower): NonNullable<RollMeta['willpowerBefore']> {
  return {
    max: willpower.max,
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
    current: willpower.current,
  }
}

export function applyWillpowerStressValue(willpower: NormalizedWillpower, amount = 1) {
  const next = {
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
  }
  let applied = 0
  const warnings: string[] = []

  for (let index = 0; index < amount; index += 1) {
    if (next.aggravated >= willpower.max) {
      warnings.push('Воля полностью заполнена тяжёлым стрессом: потратить Волю нельзя.')
      break
    }
    if (next.superficial + next.aggravated < willpower.max) {
      next.superficial += 1
      applied += 1
      continue
    }
    if (next.superficial > 0) {
      next.superficial -= 1
      next.aggravated += 1
      applied += 1
      warnings.push('Трек Воли был заполнен: один поверхностный стресс превращён в тяжёлый.')
      continue
    }
    warnings.push('Воля полностью заполнена: потратить Волю нельзя.')
    break
  }

  const normalized = normalizeWillpowerTracker(next, willpower.max)
  if (normalized.impaired) warnings.push('Трек Воли заполнен: ментальные и социальные проверки получают -2к10.')
  return { tracker: normalized, applied, warnings }
}

export function recoverWillpowerStressValue(
  willpower: NormalizedWillpower,
  amount = 1,
  severity: 'superficial' | 'aggravated' = 'superficial',
) {
  const next = {
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
  }
  let recovered = 0
  for (let index = 0; index < amount; index += 1) {
    if (severity === 'aggravated') {
      if (next.aggravated <= 0) break
      next.aggravated -= 1
      recovered += 1
      continue
    }
    if (next.superficial <= 0) break
    next.superficial -= 1
    recovered += 1
  }
  return { tracker: normalizeWillpowerTracker(next, willpower.max), recovered }
}

export function getWillpowerRecoveryPool(character?: CharacterOption | null) {
  if (!character) return 0
  return Math.max(
    getAttributeDots(character.attributes, 'Самообладание'),
    getAttributeDots(character.attributes, 'Упорство'),
  )
}

export function getWillpowerImpairmentPenalty(parts: string[], character?: CharacterOption | null) {
  const willpower = getCharacterWillpower(character)
  if (!willpower.impaired) return 0
  return parts.some(part => WILLPOWER_IMPAIRED_ATTRIBUTES.includes(part)) ? -2 : 0
}