import { createClient } from '@/games/vampires/lib/supabase'
import {
  MASTER_SCENE_OBJECTS,
  MASTER_SCENE_OBJECTS_PUBLIC,
  SCENE_OBJECTS_LOCAL_KEY,
} from '../constants'
import { mapSceneObjectRow, toSceneObjectRow } from '../mappers'
import type { MasterSceneObjectRow, SceneInteractive } from '../types'

const OBJECT_SELECT = 'id, chronicle_id, room, scene_id, object_type, name, layer_id, x, y, public_state, private_config, revealed, sort_order, created_at, updated_at'

function readLocal(room: string): SceneInteractive[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SCENE_OBJECTS_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SceneInteractive[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(room: string, rows: SceneInteractive[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SCENE_OBJECTS_LOCAL_KEY(room), JSON.stringify(rows))
}

export async function fetchSceneInteractives(
  room: string,
  sceneId: string,
): Promise<{ objects: SceneInteractive[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(MASTER_SCENE_OBJECTS)
      .select(OBJECT_SELECT)
      .eq('room', room)
      .eq('scene_id', sceneId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return {
      objects: (data || []).map(row => mapSceneObjectRow(row as MasterSceneObjectRow)),
      source: 'remote',
    }
  } catch {
    return {
      objects: readLocal(room).filter(item => item.sceneId === sceneId),
      source: 'local',
    }
  }
}

export async function upsertSceneInteractive(object: SceneInteractive): Promise<'remote' | 'local'> {
  try {
    const { error } = await createClient()
      .from(MASTER_SCENE_OBJECTS)
      .upsert(toSceneObjectRow({ ...object, updatedAt: new Date().toISOString() }), { onConflict: 'id' })
    if (error) throw error
    return 'remote'
  } catch {
    const all = readLocal(object.room)
    writeLocal(object.room, [
      { ...object, updatedAt: new Date().toISOString() },
      ...all.filter(item => item.id !== object.id),
    ])
    return 'local'
  }
}

/** Publish revealed interactive without private_config. */
export async function projectInteractivePublic(object: SceneInteractive): Promise<void> {
  if (!object.revealed) {
    await createClient().from(MASTER_SCENE_OBJECTS_PUBLIC).delete().eq('id', object.id)
    return
  }
  const { error } = await createClient().from(MASTER_SCENE_OBJECTS_PUBLIC).upsert({
    id: object.id,
    room: object.room,
    scene_id: object.sceneId,
    object_type: object.objectType,
    name: object.name,
    public_state: object.publicState,
    x: object.x,
    y: object.y,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.warn('public interactive projection failed', error)
}

export async function deleteSceneInteractive(room: string, objectId: string): Promise<void> {
  try {
    await createClient().from(MASTER_SCENE_OBJECTS).delete().eq('id', objectId)
    await createClient().from(MASTER_SCENE_OBJECTS_PUBLIC).delete().eq('id', objectId)
  } catch {
    writeLocal(room, readLocal(room).filter(item => item.id !== objectId))
  }
}
