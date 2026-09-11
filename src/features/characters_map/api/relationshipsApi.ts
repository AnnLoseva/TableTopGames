import { createCharactersMapClient } from '../supabase'
import { CHARACTERS_MAP_RELATIONSHIPS_TABLE } from '../constants'
import { mapRelationshipRow } from '../mappers'
import type { MapRelationship, MapRelationshipInput, MapRelationshipPatch, MapRelationshipRow } from '../types'

type MapClient = ReturnType<typeof createCharactersMapClient>

const RELATIONSHIP_COLUMNS = 'id, user_id, from_character_id, to_character_id, kind, label, description, color, sort_order, events, translation_en, created_at, updated_at'

async function requireUserId(client: MapClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Нужен вход в общий аккаунт TableTopGames.')
  return data.user.id
}

export async function listRelationships(client: MapClient): Promise<MapRelationship[]> {
  const { data, error } = await client
    .from(CHARACTERS_MAP_RELATIONSHIPS_TABLE)
    .select(RELATIONSHIP_COLUMNS)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as MapRelationshipRow[] ?? []).map(mapRelationshipRow)
}

export async function createRelationship(
  client: MapClient,
  input: MapRelationshipInput,
  sortOrder: number,
): Promise<MapRelationship> {
  const userId = await requireUserId(client)
  const { data, error } = await client
    .from(CHARACTERS_MAP_RELATIONSHIPS_TABLE)
    .insert({
      user_id: userId,
      from_character_id: input.fromCharacterId,
      to_character_id: input.toCharacterId,
      kind: input.kind,
      label: input.label,
      description: input.description ?? '',
      color: input.color ?? null,
      sort_order: sortOrder,
      events: [],
    })
    .select(RELATIONSHIP_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось создать связь.')
  return mapRelationshipRow(data as MapRelationshipRow)
}

export async function updateRelationship(
  client: MapClient,
  id: string,
  patch: MapRelationshipPatch,
): Promise<MapRelationship> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.kind !== undefined) payload.kind = patch.kind
  if (patch.label !== undefined) payload.label = patch.label
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.color !== undefined) payload.color = patch.color
  if (patch.events !== undefined) payload.events = patch.events
  if (patch.translationEn !== undefined) payload.translation_en = patch.translationEn

  const { data, error } = await client
    .from(CHARACTERS_MAP_RELATIONSHIPS_TABLE)
    .update(payload)
    .eq('id', id)
    .select(RELATIONSHIP_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось обновить связь.')
  return mapRelationshipRow(data as MapRelationshipRow)
}

export async function deleteRelationship(client: MapClient, id: string): Promise<void> {
  const { error } = await client
    .from(CHARACTERS_MAP_RELATIONSHIPS_TABLE)
    .delete()
    .eq('id', id)
  if (error) throw error
}
