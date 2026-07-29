/** Table module API: dice roll history (table_rolls). */
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_ROLLS } from '../constants'
import { mapRollRow } from '../mappers'
import type { OpposedRollResult, RollMessage, RollRow } from '../types'

const ROLL_SELECT_WITH_META = 'id, room, character_name, pool_name, pool_type, dice_count, dice, successes, meta, created_at'
const ROLL_SELECT_LEGACY = 'id, room, character_name, pool_name, pool_type, dice_count, dice, successes, created_at'

export type RollDbInsert = {
  id: string
  room: string
  character_name: string
  pool_name: string
  pool_type: string
  dice_count: number
  dice: unknown
  successes: number
  meta?: unknown
  created_at: string
}

export type RollDbUpdate = {
  pool_name: string
  pool_type: string
  dice_count: number
  dice: unknown
  successes: number
  meta?: unknown
}

export function buildRollInsertPayload(roll: RollMessage, opposed?: OpposedRollResult): RollDbInsert {
  return {
    id: roll.id,
    room: roll.room,
    character_name: roll.characterName,
    pool_name: roll.poolName,
    pool_type: roll.poolType,
    dice_count: roll.diceCount,
    dice: opposed || roll.dice,
    successes: roll.successes,
    meta: roll.meta || {},
    created_at: roll.createdAt,
  }
}

export function buildRollUpdatePayload(roll: RollMessage): RollDbUpdate {
  return {
    pool_name: roll.poolName,
    pool_type: roll.poolType,
    dice_count: roll.diceCount,
    dice: roll.dice,
    successes: roll.successes,
    meta: roll.meta || {},
  }
}

async function insertRollPayload(payload: RollDbInsert) {
  let { error } = await createClient().from(TABLE_ROLLS).insert(payload)
  if (error && /meta/i.test(error.message || '')) {
    const { meta, ...legacyPayload } = payload
    const fallback = await createClient().from(TABLE_ROLLS).insert(legacyPayload)
    error = fallback.error
  }
  return { error }
}

async function updateRollPayload(rollId: string, payload: RollDbUpdate) {
  let { error } = await createClient()
    .from(TABLE_ROLLS)
    .update(payload)
    .eq('id', rollId)

  if (error && /meta/i.test(error.message || '')) {
    const { meta, ...legacyPayload } = payload
    const fallback = await createClient()
      .from(TABLE_ROLLS)
      .update(legacyPayload)
      .eq('id', rollId)
    error = fallback.error
  }
  return { error }
}

export async function fetchRollHistory(room: string) {
  const initialResult = await createClient()
    .from(TABLE_ROLLS)
    .select(ROLL_SELECT_WITH_META)
    .eq('room', room)
    .order('created_at', { ascending: false })
    .limit(80)

  let rollRows: unknown[] | null = initialResult.data
  let error = initialResult.error

  if (error && /meta/i.test(error.message || '')) {
    const fallback = await createClient()
      .from(TABLE_ROLLS)
      .select(ROLL_SELECT_LEGACY)
      .eq('room', room)
      .order('created_at', { ascending: false })
      .limit(80)
    rollRows = fallback.data
    error = fallback.error
  }

  return {
    rolls: (rollRows || []).map(row => mapRollRow(row as RollRow)),
    error,
  }
}

export async function insertRollRecord(roll: RollMessage, opposed?: OpposedRollResult) {
  return insertRollPayload(buildRollInsertPayload(roll, opposed))
}

export async function updateRollRecord(rollId: string, roll: RollMessage) {
  return updateRollPayload(rollId, buildRollUpdatePayload(roll))
}