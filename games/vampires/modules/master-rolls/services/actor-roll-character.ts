import { getDerivedStats } from '@/games/vampires/core/vtm5/rules/derived-stats'
import type { MasterActor } from '@/games/vampires/modules/actors/types'
import { normalizeActor } from '@/games/vampires/modules/actors/services/actor-service'
import type { CharacterOption, CharacterType } from '@/games/vampires/modules/table/types'

function kindToCharacterType(kind: MasterActor['kind']): CharacterType {
  if (kind === 'mortal') return 'mortal'
  if (kind === 'ghoul') return 'ghoul'
  if (kind === 'thin_blood') return 'thinblood'
  return 'vampire'
}

/**
 * Builds a CharacterOption suitable for buildQuickRoll / rouse helpers
 * from a MasterActor via the actors normalizer (no GameTable).
 */
export function actorToRollCharacter(actor: MasterActor): CharacterOption {
  const normalized = normalizeActor(actor)
  const linked = actor.linkedCharacter
  if (linked) {
    return {
      ...linked,
      vitalTrackers: {
        ...(linked.vitalTrackers || {}),
        hunger: normalized.vitals.hunger,
      },
      bloodPotency: normalized.vitals.bloodPotency,
    }
  }

  const mechanics = normalized.mechanics
  const characterType = kindToCharacterType(actor.kind)
  const data = {
    attributes: mechanics.attributes || {},
    skills: mechanics.skills || {},
    disciplines: mechanics.disciplines || {},
    bloodPotency: mechanics.bloodPotency,
    humanity: mechanics.humanity,
    characterType,
    vitalTrackers: {
      hunger: mechanics.hunger,
      health: mechanics.health,
      willpower: mechanics.willpower,
    },
  }
  const derivedStats = getDerivedStats(data, null)
  const healthMax = Math.max(1, mechanics.health?.max ?? derivedStats.health.totalMax)
  const willpowerMax = Math.max(1, mechanics.willpower?.max ?? derivedStats.willpower.totalMax)
  const healthSuperficial = Math.max(0, Number(mechanics.health?.superficial) || 0)
  const healthAggravated = Math.max(0, Number(mechanics.health?.aggravated) || 0)
  const wpSuperficial = Math.max(0, Number(mechanics.willpower?.superficial) || 0)
  const wpAggravated = Math.max(0, Number(mechanics.willpower?.aggravated) || 0)

  return {
    id: actor.characterId || `actor:${actor.id}`,
    name: normalized.displayName,
    clan: normalized.clan || null,
    image: normalized.displayImage,
    characterType,
    bloodPotency: normalized.vitals.bloodPotency,
    humanity: {
      value: normalized.vitals.humanity,
      stains: 0,
      freeBoxes: Math.max(0, 10 - normalized.vitals.humanity),
      status: 'normal',
      stainEvents: [],
    },
    health: {
      superficial: healthSuperficial,
      aggravated: healthAggravated,
      bonusMax: 0,
      maxOverride: mechanics.health?.max ?? null,
      max: healthMax,
      current: Math.max(0, healthMax - healthSuperficial - healthAggravated),
      impaired: healthSuperficial + healthAggravated >= healthMax && healthMax > 0,
      defeated: false,
      physicalState: 'healthy',
    },
    willpower: {
      superficial: wpSuperficial,
      aggravated: wpAggravated,
      max: willpowerMax,
      current: Math.max(0, willpowerMax - wpSuperficial - wpAggravated),
      impaired: wpSuperficial + wpAggravated >= willpowerMax && willpowerMax > 0,
    },
    vitalTrackers: {
      hunger: normalized.vitals.hunger,
      health: {
        superficial: healthSuperficial,
        aggravated: healthAggravated,
        maxOverride: mechanics.health?.max ?? null,
      },
      willpower: {
        superficial: wpSuperficial,
        aggravated: wpAggravated,
      },
    },
    inventory: [],
    attributes: Object.fromEntries(
      Object.entries(mechanics.attributes || {}).map(([key, value]) => [key, Number(value) || 0]),
    ),
    skills: mechanics.skills || {},
    disciplines: (mechanics.disciplines || {}) as CharacterOption['disciplines'],
    selectedPowers: {},
    selectedPathPowers: {},
    derivedStats,
    activeEffects: [],
  }
}

export function resolveActorIdFromRollCharacterId(
  characterId: string | undefined,
  actors: readonly MasterActor[],
): string | null {
  if (!characterId) return null
  if (characterId.startsWith('actor:')) return characterId.slice('actor:'.length)
  const byCharacter = actors.find(actor => actor.characterId === characterId)
  return byCharacter?.id || null
}
