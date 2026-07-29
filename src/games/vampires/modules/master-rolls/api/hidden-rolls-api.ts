import { createClient } from '@/games/vampires/lib/supabase'
import type { RollMessage } from '@/games/vampires/modules/table/types'
import { MASTER_HIDDEN_ROLLS } from '../constants'
import type { MasterHiddenRollRow } from '../types'

function isRollMessage(value: unknown): value is RollMessage {
  if (!value || typeof value !== 'object') return false
  const row = value as RollMessage
  return typeof row.id === 'string'
    && typeof row.room === 'string'
    && typeof row.characterName === 'string'
    && Array.isArray(row.dice)
}

export async function insertHiddenRoll(
  chronicleId: string,
  room: string,
  roll: RollMessage,
): Promise<void> {
  const payload = {
    id: roll.id,
    chronicle_id: chronicleId,
    room,
    roll_json: { ...roll, hidden: true },
  }
  const { error } = await createClient().from(MASTER_HIDDEN_ROLLS).insert(payload)
  if (error) throw error
}

export async function fetchHiddenRolls(room: string, limit = 40): Promise<RollMessage[]> {
  const { data, error } = await createClient()
    .from(MASTER_HIDDEN_ROLLS)
    .select('id, chronicle_id, room, roll_json, revealed_at, revealed_public_roll_id, created_by, created_at')
    .eq('room', room)
    .is('revealed_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw error
  return (data || []).flatMap((row) => {
    const typed = row as MasterHiddenRollRow
    return isRollMessage(typed.roll_json) ? [{ ...typed.roll_json, hidden: true }] : []
  })
}

export async function deleteHiddenRoll(rollId: string): Promise<void> {
  const { error } = await createClient().from(MASTER_HIDDEN_ROLLS).delete().eq('id', rollId)
  if (error) throw error
}

export async function markHiddenRollRevealed(
  rollId: string,
  publicRollId: string,
): Promise<void> {
  const { error } = await createClient().from(MASTER_HIDDEN_ROLLS).update({
    revealed_at: new Date().toISOString(),
    revealed_public_roll_id: publicRollId,
  }).eq('id', rollId)
  if (error) throw error
}

export async function loadHiddenRollById(rollId: string): Promise<RollMessage | null> {
  const { data, error } = await createClient()
    .from(MASTER_HIDDEN_ROLLS)
    .select('roll_json, revealed_at')
    .eq('id', rollId)
    .maybeSingle()
  if (error) throw error
  if (!data || data.revealed_at) return null
  return isRollMessage(data.roll_json) ? { ...data.roll_json, hidden: true } : null
}
