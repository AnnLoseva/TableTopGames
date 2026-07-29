import { createClient } from '@/games/vampires/lib/supabase'
import { fetchCharactersByIds } from '@/games/vampires/modules/table/api/character-api'
import { CHARACTERS } from '@/games/vampires/modules/table/constants'
import { mapCharacterRow } from '@/games/vampires/modules/table/mappers'
import { CHRONICLE_ACTORS, CHRONICLE_ACTOR_PRIVATE } from '../constants'
import { mapActorPrivateRow, mapChronicleActorRow, toActorBulkPatch } from '../mappers'
import type {
  ActorBulkPatch,
  ActorPrivateRow,
  ChronicleActor,
  ChronicleActorRow,
  CreateCompactActorInput,
  MasterActor,
  ActorPrivateFields,
} from '../types'

const ACTOR_SELECT = 'id, chronicle_id, room, kind, character_id, name, faction, actor_role, status, tags, current_scene_id, compact_stats, image_url, manual_overrides, created_by, created_at, updated_at'
const PRIVATE_SELECT = 'actor_id, chronicle_id, room, secrets, motivation, plans, notes, private_data, created_at, updated_at'

export async function loadActorsByRoom(room: string): Promise<ChronicleActor[]> {
  const { data, error } = await createClient()
    .from(CHRONICLE_ACTORS)
    .select(ACTOR_SELECT)
    .eq('room', room)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []).map((row: unknown) => mapChronicleActorRow(row as ChronicleActorRow))
}

export async function loadMasterActorsByRoom(room: string): Promise<MasterActor[]> {
  const actors = await loadActorsByRoom(room)
  const linkedIds = actors.flatMap(actor => actor.characterId ? [actor.characterId] : [])
  const [{ rows: characters, error: characterError }, privateResult] = await Promise.all([
    fetchCharactersByIds(linkedIds),
    createClient().from(CHRONICLE_ACTOR_PRIVATE).select(PRIVATE_SELECT).eq('room', room),
  ])
  if (characterError) throw characterError
  if (privateResult.error) throw privateResult.error

  const charactersById = new Map(characters.map(row => [row.id, mapCharacterRow(row)]))
  const privateByActorId = new Map(
    (privateResult.data || []).map(row => {
      const privateRow = row as ActorPrivateRow
      return [privateRow.actor_id, mapActorPrivateRow(privateRow)] as const
    }),
  )

  return actors.map(actor => ({
    ...actor,
    linkedCharacter: actor.characterId ? charactersById.get(actor.characterId) || null : null,
    privateFields: privateByActorId.get(actor.id) || null,
  }))
}

export async function createCompactActor(input: CreateCompactActorInput): Promise<ChronicleActor> {
  const client = createClient()
  const { data, error } = await client.from(CHRONICLE_ACTORS).insert({
    chronicle_id: input.chronicleId,
    room: input.room,
    kind: input.kind,
    character_id: null,
    name: input.name,
    faction: input.faction,
    actor_role: input.actorRole,
    status: input.status,
    tags: input.tags,
    current_scene_id: input.currentSceneId,
    compact_stats: input.compactStats,
    image_url: input.imageUrl,
    manual_overrides: input.manualOverrides,
  }).select(ACTOR_SELECT).single()
  if (error || !data) throw error || new Error('Compact actor was not created')

  const actor = mapChronicleActorRow(data as ChronicleActorRow)
  if (input.privateFields) {
    try {
      await updateActorPrivateFields(actor, input.privateFields)
    } catch (privateError) {
      await client.from(CHRONICLE_ACTORS).delete().eq('id', actor.id)
      throw privateError
    }
  }
  return actor
}

export async function updateCompactActor(
  actorId: string,
  patch: Partial<Pick<ChronicleActor, 'name' | 'faction' | 'actorRole' | 'status' | 'tags' | 'currentSceneId' | 'compactStats' | 'imageUrl' | 'manualOverrides'>>,
) {
  const { data, error } = await createClient().from(CHRONICLE_ACTORS).update({
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...toActorBulkPatch(patch),
    updated_at: new Date().toISOString(),
  }).eq('id', actorId).is('character_id', null).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Compact actor was not found or is linked to a full sheet')
}

export async function bulkUpdateActors(room: string, actorIds: readonly string[], patch: ActorBulkPatch) {
  const { data, error } = await createClient().rpc('bulk_update_chronicle_actors', {
    p_room: room,
    p_actor_ids: [...new Set(actorIds)],
    p_patch: toActorBulkPatch(patch),
  })
  if (error) throw error
  return (data || []).map((row: unknown) => mapChronicleActorRow(row as ChronicleActorRow))
}

export type OwnCharacterSummary = {
  id: string
  name: string
  clan: string
  image: string
}

type OwnCharacterRow = {
  id: string
  name: string | null
  clan: string | null
  image: string | null
}

/** All characters of the app user (legacy `users` auth) for master import. */
export async function listOwnCharacters(userId: string): Promise<OwnCharacterSummary[]> {
  const { data, error } = await createClient()
    .from(CHARACTERS)
    .select('id, name, clan, image:data->>characterImage')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []).map(row => {
    const character = row as OwnCharacterRow
    return {
      id: character.id,
      name: character.name || 'Без имени',
      clan: character.clan || '',
      image: character.image || '',
    }
  })
}

/**
 * Create an actor already linked to an existing `characters` row.
 * The sheet stays the source of truth; the actor row holds chronicle metadata.
 */
export async function createLinkedActorFromCharacter(input: {
  chronicleId: string
  room: string
  characterId: string
  name: string
  imageUrl?: string
  kind?: ChronicleActor['kind']
}): Promise<ChronicleActor> {
  const { data, error } = await createClient().from(CHRONICLE_ACTORS).insert({
    chronicle_id: input.chronicleId,
    room: input.room,
    kind: input.kind || 'full_npc',
    character_id: input.characterId,
    name: input.name.trim() || 'Актор',
    image_url: input.imageUrl || '',
  }).select(ACTOR_SELECT).single()
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('Этот персонаж уже добавлен как актёр в этой хронике')
    }
    throw error
  }
  if (!data) throw new Error('Linked actor was not created')
  return mapChronicleActorRow(data as ChronicleActorRow)
}

export async function linkExistingCharacter(actorId: string, characterId: string, kind?: ChronicleActor['kind']) {
  const { error } = await createClient().from(CHRONICLE_ACTORS).update({
    character_id: characterId,
    ...(kind ? { kind } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', actorId)
  if (error) throw error
}

export async function unlinkCharacter(actorId: string) {
  const { error } = await createClient().from(CHRONICLE_ACTORS).update({
    character_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', actorId)
  if (error) throw error
}

export async function updateActorPrivateFields(
  actor: Pick<ChronicleActor, 'id' | 'chronicleId' | 'room'>,
  fields: ActorPrivateFields,
) {
  const client = createClient()
  const updatedAt = new Date().toISOString()
  const mutableFields = {
    secrets: fields.secrets,
    motivation: fields.motivation,
    plans: fields.plans,
    notes: fields.notes,
    private_data: fields.privateData,
    updated_at: updatedAt,
  }

  // Avoid relying on PostgREST's on_conflict schema cache here: a deployment
  // whose inferred conflict constraint is stale rejects an otherwise valid
  // upsert with HTTP 400.
  const { data: updated, error: updateError } = await client
    .from(CHRONICLE_ACTOR_PRIVATE)
    .update(mutableFields)
    .eq('actor_id', actor.id)
    .select('actor_id')
    .maybeSingle()
  if (updateError) throw actorPrivateWriteError('Не удалось обновить приватные поля актёра', updateError)
  if (updated) return

  const { error: insertError } = await client.from(CHRONICLE_ACTOR_PRIVATE).insert({
    actor_id: actor.id,
    chronicle_id: actor.chronicleId,
    room: actor.room,
    ...mutableFields,
  })
  if (insertError) throw actorPrivateWriteError('Не удалось создать приватные поля актёра', insertError)
}

function actorPrivateWriteError(
  context: string,
  error: { code?: string; message?: string; details?: string; hint?: string },
) {
  const details = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' · ')
  return new Error(details ? `${context}: ${details}` : context)
}

export async function updateActorMeta(
  actorId: string,
  patch: Partial<Pick<ChronicleActor, 'name' | 'faction' | 'actorRole' | 'status' | 'tags' | 'currentSceneId' | 'compactStats' | 'imageUrl' | 'manualOverrides'>>,
) {
  const { data, error } = await createClient().from(CHRONICLE_ACTORS).update({
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...toActorBulkPatch(patch),
    updated_at: new Date().toISOString(),
  }).eq('id', actorId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Actor was not found')
}

export async function cloneActor(source: MasterActor, nameSuffix = ' (копия)'): Promise<ChronicleActor> {
  const baseName = source.name || source.linkedCharacter?.name || 'Актор'
  const kind = source.kind === 'player_character' ? 'full_npc' : source.kind
  return createCompactActor({
    chronicleId: source.chronicleId,
    room: source.room,
    kind,
    name: `${baseName}${nameSuffix}`,
    faction: source.faction,
    actorRole: source.actorRole,
    status: source.status === 'archived' ? 'active' : source.status,
    tags: [...source.tags],
    currentSceneId: null,
    compactStats: source.characterId
      ? {
          ...source.compactStats,
          attributes: source.linkedCharacter?.attributes || source.compactStats.attributes || {},
          skills: source.linkedCharacter?.skills || source.compactStats.skills || {},
          disciplines: Object.fromEntries(
            Object.entries(source.linkedCharacter?.disciplines || source.compactStats.disciplines || {}),
          ),
          health: source.linkedCharacter?.health || source.compactStats.health,
          willpower: source.linkedCharacter?.willpower || source.compactStats.willpower,
          hunger: Number(source.linkedCharacter?.vitalTrackers?.hunger ?? source.compactStats.hunger) || 0,
          humanity: source.linkedCharacter?.humanity?.value ?? source.compactStats.humanity,
          bloodPotency: source.linkedCharacter?.bloodPotency ?? source.compactStats.bloodPotency,
          clan: source.linkedCharacter?.clan || source.compactStats.clan,
        }
      : { ...source.compactStats },
    imageUrl: source.imageUrl || source.linkedCharacter?.image || '',
    manualOverrides: {},
    privateFields: source.privateFields
      ? {
          secrets: source.privateFields.secrets,
          motivation: source.privateFields.motivation,
          plans: source.privateFields.plans,
          notes: source.privateFields.notes,
          privateData: { ...source.privateFields.privateData },
        }
      : undefined,
  })
}
