import { CHRONICLE_SNAPSHOTS_TABLE } from '../constants'
import { mapSnapshotRow } from '../mappers'
import { createChronicleClient } from '../supabase'
import type { Snapshot, SnapshotPatch, SnapshotRow } from '../types'

type ChronicleClient = ReturnType<typeof createChronicleClient>

const SNAPSHOT_COLUMNS = 'id, user_id, year, month, day, label, description, cover_image, sort_order, created_at, updated_at'

export async function listSnapshots(client: ChronicleClient): Promise<Snapshot[]> {
  const { data, error } = await client
    .from(CHRONICLE_SNAPSHOTS_TABLE)
    .select(SNAPSHOT_COLUMNS)
    .order('year', { ascending: true })
  if (error) throw error
  return (data as SnapshotRow[] ?? []).map(mapSnapshotRow)
}

export async function createSnapshot(
  client: ChronicleClient,
  input: { year: number; label: string },
): Promise<Snapshot> {
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) throw new Error('Нужен вход в аккаунт автора.')
  const { data, error } = await client
    .from(CHRONICLE_SNAPSHOTS_TABLE)
    .insert({ user_id: userData.user.id, year: input.year, label: input.label })
    .select(SNAPSHOT_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось создать точку.')
  return mapSnapshotRow(data as SnapshotRow)
}

export async function updateSnapshot(
  client: ChronicleClient,
  id: string,
  patch: SnapshotPatch,
): Promise<Snapshot> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.year !== undefined) payload.year = patch.year
  if (patch.month !== undefined) payload.month = patch.month
  if (patch.day !== undefined) payload.day = patch.day
  if (patch.label !== undefined) payload.label = patch.label
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.coverImage !== undefined) payload.cover_image = patch.coverImage
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder
  const { data, error } = await client
    .from(CHRONICLE_SNAPSHOTS_TABLE)
    .update(payload)
    .eq('id', id)
    .select(SNAPSHOT_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось сохранить точку.')
  return mapSnapshotRow(data as SnapshotRow)
}

export async function deleteSnapshot(client: ChronicleClient, id: string): Promise<void> {
  const { error } = await client.from(CHRONICLE_SNAPSHOTS_TABLE).delete().eq('id', id)
  if (error) throw error
}
