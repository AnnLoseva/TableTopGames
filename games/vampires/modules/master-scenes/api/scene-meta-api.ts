import { createClient } from '@/games/vampires/lib/supabase'
import { MASTER_SCENE_META, SCENE_META_LOCAL_KEY } from '../constants'
import { mapSceneMetaRow, toSceneMetaRow } from '../mappers'
import type { MasterSceneMeta, MasterSceneMetaRow } from '../types'

const META_SELECT = 'scene_id, chronicle_id, room, sort_order, archived, encounter_marker, draft_light_preset, published_light_preset, status, notes, updated_at'

function readLocal(room: string): MasterSceneMeta[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SCENE_META_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as MasterSceneMeta[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(room: string, rows: MasterSceneMeta[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SCENE_META_LOCAL_KEY(room), JSON.stringify(rows))
}

export async function fetchSceneMeta(room: string): Promise<{ meta: MasterSceneMeta[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(MASTER_SCENE_META)
      .select(META_SELECT)
      .eq('room', room)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return {
      meta: (data || []).map(row => mapSceneMetaRow(row as MasterSceneMetaRow)),
      source: 'remote',
    }
  } catch {
    return { meta: readLocal(room), source: 'local' }
  }
}

export async function upsertSceneMeta(meta: MasterSceneMeta): Promise<'remote' | 'local'> {
  try {
    const { error } = await createClient()
      .from(MASTER_SCENE_META)
      .upsert(toSceneMetaRow({ ...meta, updatedAt: new Date().toISOString() }), { onConflict: 'scene_id' })
    if (error) throw error
    return 'remote'
  } catch {
    const existing = readLocal(meta.room)
    writeLocal(meta.room, [
      { ...meta, updatedAt: new Date().toISOString() },
      ...existing.filter(item => item.sceneId !== meta.sceneId),
    ])
    return 'local'
  }
}
