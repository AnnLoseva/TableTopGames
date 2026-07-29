/** Table module API: character control assignments (table_character_controllers). */
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_CHARACTER_CONTROLLERS } from '../constants'
import { mapControllerRow } from '../mappers'
import type { CharacterController, CharacterControllerRow } from '../types'
import { createTableId } from './scene-api'

const CONTROLLER_SELECT = 'id, room, character_id, user_id, can_move_token, can_open_sheet, can_roll_dice, can_resize_token, created_at'

export async function fetchControllersForRoom(room: string) {
  const { data, error } = await createClient()
    .from(TABLE_CHARACTER_CONTROLLERS)
    .select(CONTROLLER_SELECT)
    .eq('room', room)
    .order('created_at', { ascending: true })

  return {
    controllers: data ? data.map(row => mapControllerRow(row as CharacterControllerRow)) : [],
    error,
  }
}

export async function insertController(controller: Omit<CharacterController, 'id' | 'createdAt'>) {
  const row = {
    id: createTableId(),
    room: controller.room,
    character_id: controller.characterId,
    user_id: controller.userId,
    can_move_token: controller.canMoveToken,
    can_open_sheet: controller.canOpenSheet,
    can_roll_dice: controller.canRollDice,
    can_resize_token: controller.canResizeToken,
    created_at: new Date().toISOString(),
  }
  return createClient().from(TABLE_CHARACTER_CONTROLLERS).insert(row)
}

export async function deleteControllerRecord(controllerId: string) {
  return createClient().from(TABLE_CHARACTER_CONTROLLERS).delete().eq('id', controllerId)
}

/** Lightweight character search for the master's assignment picker. */
export async function searchCharactersByName(query: string, limit = 20) {
  let request = createClient()
    .from('characters')
    .select('id, user_id, name, clan, data')
    .order('updated_at', { ascending: false })
    .limit(limit)

  const trimmed = query.trim()
  if (trimmed) request = request.ilike('name', `%${trimmed}%`)

  const { data, error } = await request
  return { rows: data ?? [], error }
}
