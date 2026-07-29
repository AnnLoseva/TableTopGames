import { getAttributeDots } from '@/games/vampires/lib/i18n/ruleNames'
import { getPassiveTrackerModifiers } from '../disciplines/effects'

type JsonObject = Record<string, unknown>

export type DerivedTrackerStats = {
  baseMax: number
  passiveBonus: number
  legacyBonus: number
  totalMax: number
}

export type CharacterDerivedStats = {
  health: DerivedTrackerStats
  willpower: DerivedTrackerStats
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getCharacterData(characterData: unknown): JsonObject {
  if (!isObject(characterData)) return {}
  return isObject(characterData.data) ? characterData.data : characterData
}

function getLegacyHealthSettings(characterData: JsonObject) {
  const vitalTrackers = isObject(characterData.vitalTrackers)
    ? characterData.vitalTrackers
    : {}
  const health = isObject(vitalTrackers.health)
    ? vitalTrackers.health
    : {}
  const legacyBonus = Math.max(0, Math.floor(Number(health.bonusMax) || 0))
  const maxOverride = health.maxOverride === null
    || health.maxOverride === undefined
    ? null
    : Math.max(0, Math.floor(Number(health.maxOverride) || 0))
  return { legacyBonus, maxOverride }
}

export function getDerivedStats(
  characterData: unknown,
  rules: unknown,
): CharacterDerivedStats {
  const data = getCharacterData(characterData)
  const attributes = isObject(data.attributes) ? data.attributes : {}
  const healthBaseMax = Math.max(
    0,
    Math.floor(getAttributeDots(attributes, 'Выносливость') + 3),
  )
  const willpowerBaseMax = Math.max(
    0,
    Math.floor(
      getAttributeDots(attributes, 'Самообладание')
      + getAttributeDots(attributes, 'Упорство'),
    ),
  )
  const modifiers = getPassiveTrackerModifiers(data, rules)
  const healthPassiveBonus = Math.floor(
    modifiers
      .filter((modifier) => modifier.tracker === 'health')
      .reduce((total, modifier) => total + modifier.value, 0),
  )
  const willpowerPassiveBonus = Math.floor(
    modifiers
      .filter((modifier) => modifier.tracker === 'willpower')
      .reduce((total, modifier) => total + modifier.value, 0),
  )
  const { legacyBonus: healthLegacyBonus, maxOverride } =
    getLegacyHealthSettings(data)

  return {
    health: {
      baseMax: healthBaseMax,
      passiveBonus: healthPassiveBonus,
      legacyBonus: healthLegacyBonus,
      totalMax: maxOverride ?? Math.max(
        0,
        healthBaseMax + healthLegacyBonus + healthPassiveBonus,
      ),
    },
    willpower: {
      baseMax: willpowerBaseMax,
      passiveBonus: willpowerPassiveBonus,
      legacyBonus: 0,
      totalMax: Math.max(0, willpowerBaseMax + willpowerPassiveBonus),
    },
  }
}
