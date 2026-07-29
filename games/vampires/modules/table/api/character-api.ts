/** Table module API: character sheet fetch/update at the table (characters). */
import { createClient } from '@/games/vampires/lib/supabase'
import { CHARACTERS } from '../constants'
import type { CharacterRow } from '../types'

export const CHARACTER_SELECT_FULL = 'id, user_id, name, clan, data'
export const CHARACTER_SELECT_DATA = 'data'

export async function fetchCharacterById(
  characterId: string,
  options: { userId?: string; select?: string } = {},
) {
  let query = createClient()
    .from(CHARACTERS)
    .select(options.select || CHARACTER_SELECT_FULL)
    .eq('id', characterId)

  if (options.userId) {
    query = query.eq('user_id', options.userId)
  }

  const { data, error } = await query.single()
  return { row: (data as CharacterRow | null) ?? null, error }
}

export async function fetchCharactersByIds(characterIds: readonly string[]) {
  if (characterIds.length === 0) return { rows: [] as CharacterRow[], error: null }

  const { data, error } = await createClient()
    .from(CHARACTERS)
    .select(CHARACTER_SELECT_FULL)
    .in('id', [...new Set(characterIds)])

  return { rows: (data as CharacterRow[] | null) ?? [], error }
}

export async function updateCharacterData(
  characterId: string,
  nextData: NonNullable<CharacterRow['data']> | Record<string, unknown>,
  options: { userId?: string } = {},
) {
  let query = createClient()
    .from(CHARACTERS)
    .update({ data: nextData })
    .eq('id', characterId)

  if (options.userId) {
    query = query.eq('user_id', options.userId)
  }

  return query
}
