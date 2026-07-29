import { createVtm5ActorAdapter } from '@/games/vampires/core/vtm5/adapters/actors'
import type { CharacterOption } from '@/games/vampires/modules/table/types'
import type {
  ActorPublicPayload,
  CharacterConversionDraft,
  CompactActorStats,
  MasterActor,
  NormalizedActor,
} from '../types'
import { linkExistingCharacter } from '../api'

const actorAdapter = createVtm5ActorAdapter()

function linkedMechanics(character: CharacterOption, kind: MasterActor['kind']) {
  return {
    kind,
    attributes: character.attributes,
    skills: character.skills,
    disciplines: Object.fromEntries(Object.entries(character.disciplines).map(([name, paths]) => [name, paths])),
    health: character.health,
    willpower: character.willpower,
    hunger: Number(character.vitalTrackers?.hunger) || 0,
    humanity: character.humanity?.value || 0,
    bloodPotency: character.bloodPotency || 0,
  }
}

function compactMechanics(actor: MasterActor) {
  const stats = actor.compactStats || {} as CompactActorStats
  return {
    kind: actor.kind,
    attributes: stats.attributes || {},
    skills: stats.skills || {},
    disciplines: stats.disciplines || {},
    health: stats.health,
    willpower: stats.willpower,
    hunger: stats.hunger,
    humanity: stats.humanity,
    bloodPotency: stats.bloodPotency,
  }
}

export function normalizeActor(actor: MasterActor): NormalizedActor {
  const { privateFields: _privateFields, ...actorWithoutPrivate } = actor
  const linked = actor.linkedCharacter
  const baseMechanics = linked ? linkedMechanics(linked, actor.kind) : compactMechanics(actor)
  const overrideStats = typeof actor.manualOverrides.stats === 'object' && actor.manualOverrides.stats
    ? actor.manualOverrides.stats as Partial<CompactActorStats>
    : {}
  const mechanics = {
    ...baseMechanics,
    ...overrideStats,
    kind: actor.kind,
    attributes: { ...baseMechanics.attributes, ...(overrideStats.attributes || {}) },
    skills: { ...baseMechanics.skills, ...(overrideStats.skills || {}) },
    disciplines: { ...baseMechanics.disciplines, ...(overrideStats.disciplines || {}) },
  }

  return {
    ...actorWithoutPrivate,
    source: linked ? 'linked_character' : 'compact',
    displayName: String(actor.manualOverrides.name || linked?.name || actor.name),
    displayImage: String(actor.manualOverrides.imageUrl || linked?.image || actor.imageUrl),
    clan: String(actor.manualOverrides.clan || linked?.clan || actor.compactStats.clan || ''),
    mechanics,
    vitals: actorAdapter.calculateDisplayVitals(mechanics),
    linkedCharacter: linked,
  }
}

export function calculateActorDisplayVitals(actor: MasterActor) {
  return normalizeActor(actor).vitals
}

export function getActorRollPool(actor: MasterActor, traits: readonly string[], modifier = 0) {
  const normalized = normalizeActor(actor)
  return actorAdapter.getRollPool(normalized.mechanics, { traits, modifier })
}

export function toActorPublicPayload(actor: MasterActor): ActorPublicPayload {
  const normalized = normalizeActor(actor)
  return {
    id: normalized.id,
    chronicleId: normalized.chronicleId,
    room: normalized.room,
    kind: normalized.kind,
    characterId: normalized.characterId,
    faction: normalized.faction,
    actorRole: normalized.actorRole,
    status: normalized.status,
    tags: normalized.tags,
    currentSceneId: normalized.currentSceneId,
    source: normalized.source,
    displayName: normalized.displayName,
    displayImage: normalized.displayImage,
    clan: normalized.clan,
    mechanics: normalized.mechanics,
    vitals: normalized.vitals,
    updatedAt: normalized.updatedAt,
  }
}

export function prepareCompactActorConversion(actor: MasterActor): CharacterConversionDraft {
  if (actor.characterId) throw new Error('Actor is already linked to a full character sheet')
  const normalized = normalizeActor(actor)
  return {
    name: normalized.displayName,
    clan: normalized.clan || null,
    data: {
      characterImage: normalized.displayImage,
      characterType: actor.kind === 'mortal' ? 'mortal' : actor.kind === 'ghoul' ? 'ghoul' : actor.kind === 'thin_blood' ? 'thinblood' : 'vampire',
      bloodPotency: normalized.mechanics.bloodPotency,
      humanity: normalized.mechanics.humanity,
      vitalTrackers: {
        health: normalized.mechanics.health ? {
          superficial: normalized.mechanics.health.superficial || 0,
          aggravated: normalized.mechanics.health.aggravated || 0,
          maxOverride: normalized.mechanics.health.max ?? null,
        } : undefined,
        willpower: normalized.mechanics.willpower ? {
          superficial: normalized.mechanics.willpower.superficial || 0,
          aggravated: normalized.mechanics.willpower.aggravated || 0,
        } : undefined,
        hunger: normalized.mechanics.hunger,
      },
      attributes: normalized.mechanics.attributes,
      skills: normalized.mechanics.skills,
      disciplines: normalized.mechanics.disciplines,
    },
  }
}

export async function convertCompactActorToFullSheet(
  actor: MasterActor,
  createFullSheet: (draft: CharacterConversionDraft) => Promise<{ characterId: string }>,
) {
  const draft = prepareCompactActorConversion(actor)
  const { characterId } = await createFullSheet(draft)
  await linkExistingCharacter(actor.id, characterId, 'full_npc')
  return characterId
}
