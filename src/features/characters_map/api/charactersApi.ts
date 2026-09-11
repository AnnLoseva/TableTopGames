import { createCharactersMapClient } from '../supabase'
import { CHARACTERS_MAP_CHARACTERS_TABLE, CHARACTERS_MAP_IMAGES_BUCKET } from '../constants'
import { mapCharacterRow } from '../mappers'
import type { MapCharacter, MapCharacterInput, MapCharacterPatch, MapCharacterRow } from '../types'

type MapClient = ReturnType<typeof createCharactersMapClient>

const CHARACTER_COLUMNS = 'id, user_id, name, description, image_path, position_x, position_y, sheet, translation_en, created_at, updated_at'

async function requireUserId(client: MapClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Нужен вход в общий аккаунт TableTopGames.')
  return data.user.id
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'image'
}

export async function listCharacters(client: MapClient): Promise<MapCharacter[]> {
  const { data, error } = await client
    .from(CHARACTERS_MAP_CHARACTERS_TABLE)
    .select(CHARACTER_COLUMNS)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as MapCharacterRow[] ?? []).map(mapCharacterRow)
}

export async function createCharacter(client: MapClient, input: MapCharacterInput): Promise<MapCharacter> {
  const userId = await requireUserId(client)
  const { data, error } = await client
    .from(CHARACTERS_MAP_CHARACTERS_TABLE)
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description,
      image_path: input.imagePath ?? null,
      position_x: input.positionX ?? 0,
      position_y: input.positionY ?? 0,
      sheet: input.sheet ?? {},
    })
    .select(CHARACTER_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось создать персонажа.')
  return mapCharacterRow(data as MapCharacterRow)
}

export async function updateCharacter(
  client: MapClient,
  id: string,
  patch: MapCharacterPatch,
): Promise<MapCharacter> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.imagePath !== undefined) payload.image_path = patch.imagePath
  if (patch.positionX !== undefined) payload.position_x = patch.positionX
  if (patch.positionY !== undefined) payload.position_y = patch.positionY
  if (patch.sheet !== undefined) payload.sheet = patch.sheet
  if (patch.translationEn !== undefined) payload.translation_en = patch.translationEn

  const { data, error } = await client
    .from(CHARACTERS_MAP_CHARACTERS_TABLE)
    .update(payload)
    .eq('id', id)
    .select(CHARACTER_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось обновить персонажа.')
  return mapCharacterRow(data as MapCharacterRow)
}

export async function deleteCharacter(client: MapClient, character: MapCharacter): Promise<void> {
  const { error } = await client
    .from(CHARACTERS_MAP_CHARACTERS_TABLE)
    .delete()
    .eq('id', character.id)
  if (error) throw error
  if (character.imagePath) {
    await client.storage.from(CHARACTERS_MAP_IMAGES_BUCKET).remove([character.imagePath])
  }
}

export async function uploadCharacterImage(client: MapClient, file: File): Promise<string> {
  const userId = await requireUserId(client)
  const storagePath = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error } = await client.storage
    .from(CHARACTERS_MAP_IMAGES_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return storagePath
}

export function getCharacterImageUrl(client: MapClient, imagePath: string): string {
  return client.storage.from(CHARACTERS_MAP_IMAGES_BUCKET).getPublicUrl(imagePath).data.publicUrl
}

export async function removeCharacterImageFile(client: MapClient, imagePath: string): Promise<void> {
  await client.storage.from(CHARACTERS_MAP_IMAGES_BUCKET).remove([imagePath])
}
