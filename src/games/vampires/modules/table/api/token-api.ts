/** Table module API: character tokens (table_tokens). */
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_TOKENS } from '../constants'
import { mapTokenRow, toTokenDbPatch } from '../mappers'
import type { CharacterToken, CharacterTokenRow, TokenPatch } from '../types'
import { sortTokens } from '../utils/token-utils'

const TOKEN_SELECT = 'id, room, scene_id, character_id, character_name, image_url, owner_user_id, x, y, width, height, z_index, created_at, updated_at'

export function toTokenDbRow(token: CharacterToken) {
  return {
    id: token.id,
    room: token.room,
    scene_id: token.sceneId,
    character_id: token.characterId,
    character_name: token.characterName,
    image_url: token.imageUrl,
    owner_user_id: token.ownerUserId,
    x: token.x,
    y: token.y,
    width: token.width,
    height: token.height,
    z_index: token.zIndex,
    created_at: token.createdAt,
    updated_at: token.updatedAt,
  }
}

export async function fetchTokensForScene(room: string, sceneId: string) {
  const { data, error } = await createClient()
    .from(TABLE_TOKENS)
    .select(TOKEN_SELECT)
    .eq('room', room)
    .eq('scene_id', sceneId)
    .order('z_index', { ascending: true })
    .limit(120)

  return {
    tokens: data ? sortTokens(data.map(row => mapTokenRow(row as CharacterTokenRow))) : [],
    error,
  }
}

export async function insertToken(token: CharacterToken) {
  return createClient().from(TABLE_TOKENS).insert(toTokenDbRow(token))
}

export async function updateTokenRecord(tokenId: string, patch: TokenPatch) {
  return createClient().from(TABLE_TOKENS).update(toTokenDbPatch(patch)).eq('id', tokenId)
}

export async function deleteTokenRecord(tokenId: string) {
  return createClient().from(TABLE_TOKENS).delete().eq('id', tokenId)
}

export async function deleteTokensByScene(sceneId: string) {
  return createClient().from(TABLE_TOKENS).delete().eq('scene_id', sceneId)
}
