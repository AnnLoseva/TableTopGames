/** Table module API: scenes and per-scene music tracks (table_scenes, table_scene_music). */
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_IMAGES, TABLE_SCENE_MUSIC, TABLE_SCENES } from '../constants'
import { mapSceneMusicRow, mapSceneRow } from '../mappers'
import type { SceneMusicRow, SceneMusicTrack, TableScene, TableSceneRow } from '../types'
import { sortSceneMusic, sortScenes } from '../utils/scene-utils'

const SCENE_SELECT = 'id, room, name, thumbnail_url, is_active, background_url, width, height, created_by, created_at, updated_at'
const SCENE_MUSIC_SELECT = 'id, room, scene_id, title, url, source_type, order_index, is_default, autoplay, created_at, updated_at'

export function createTableId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function toSceneDbRow(scene: TableScene) {
  return {
    id: scene.id,
    room: scene.room,
    name: scene.name,
    thumbnail_url: scene.thumbnailUrl,
    is_active: scene.isActive,
    background_url: scene.backgroundUrl,
    width: scene.width,
    height: scene.height,
    created_by: scene.createdBy,
    created_at: scene.createdAt,
    updated_at: scene.updatedAt,
  }
}

export function toSceneMusicDbRow(track: SceneMusicTrack) {
  return {
    id: track.id,
    room: track.room,
    scene_id: track.sceneId,
    title: track.title,
    url: track.url,
    source_type: track.sourceType,
    order_index: track.orderIndex,
    is_default: track.isDefault,
    autoplay: track.autoplay,
    created_at: track.createdAt,
    updated_at: track.updatedAt,
  }
}

export async function fetchScenes(room: string) {
  const { data, error } = await createClient()
    .from(TABLE_SCENES)
    .select(SCENE_SELECT)
    .eq('room', room)
    .order('created_at', { ascending: true })

  return {
    scenes: data ? sortScenes(data.map(row => mapSceneRow(row as TableSceneRow))) : [],
    error,
  }
}

export async function insertScene(scene: TableScene) {
  return createClient().from(TABLE_SCENES).insert(toSceneDbRow(scene))
}

export async function updateSceneRecord(
  sceneId: string,
  patch: {
    name?: string
    thumbnail_url?: string
    is_active?: boolean
    background_url?: string
    width?: number
    height?: number
    updated_at: string
  },
) {
  return createClient().from(TABLE_SCENES).update(patch).eq('id', sceneId)
}

export async function deleteSceneRecord(sceneId: string) {
  return createClient().from(TABLE_SCENES).delete().eq('id', sceneId)
}

export async function deactivateOtherScenes(room: string, activeSceneId: string) {
  return createClient()
    .from(TABLE_SCENES)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('room', room)
    .neq('id', activeSceneId)
}

export async function activateSceneRecord(sceneId: string) {
  return createClient()
    .from(TABLE_SCENES)
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', sceneId)
}

export async function assignOrphanLayersToScene(room: string, sceneId: string) {
  return createClient()
    .from(TABLE_IMAGES)
    .update({ scene_id: sceneId })
    .eq('room', room)
    .is('scene_id', null)
}

export async function deleteSceneLayers(sceneId: string) {
  return createClient().from(TABLE_IMAGES).delete().eq('scene_id', sceneId)
}

export async function fetchSceneMusic(room: string, sceneId: string) {
  const { data, error } = await createClient()
    .from(TABLE_SCENE_MUSIC)
    .select(SCENE_MUSIC_SELECT)
    .eq('room', room)
    .eq('scene_id', sceneId)
    .order('order_index', { ascending: true })

  return {
    tracks: data ? sortSceneMusic(data.map(row => mapSceneMusicRow(row as SceneMusicRow))) : [],
    error,
  }
}

export async function insertSceneMusic(track: SceneMusicTrack) {
  return createClient().from(TABLE_SCENE_MUSIC).insert(toSceneMusicDbRow(track))
}

export async function updateSceneMusicRecord(
  trackId: string,
  patch: {
    title?: string
    url?: string
    source_type?: string
    order_index?: number
    is_default?: boolean
    autoplay?: boolean
    updated_at: string
  },
) {
  return createClient().from(TABLE_SCENE_MUSIC).update(patch).eq('id', trackId)
}

export async function clearSceneMusicDefaults(sceneId: string, exceptTrackId?: string) {
  let query = createClient()
    .from(TABLE_SCENE_MUSIC)
    .update({ is_default: false })
    .eq('scene_id', sceneId)

  if (exceptTrackId) {
    query = query.neq('id', exceptTrackId)
  }

  return query
}

export async function deleteSceneMusicByScene(sceneId: string) {
  return createClient().from(TABLE_SCENE_MUSIC).delete().eq('scene_id', sceneId)
}

export async function deleteSceneMusicRecord(trackId: string) {
  return createClient().from(TABLE_SCENE_MUSIC).delete().eq('id', trackId)
}

export async function deleteSceneWithAssets(sceneId: string) {
  await deleteSceneMusicByScene(sceneId)
  await deleteSceneLayers(sceneId)
  await deleteSceneTokens(sceneId)
  return deleteSceneRecord(sceneId)
}

async function deleteSceneTokens(sceneId: string) {
  const { deleteTokensByScene } = await import('./token-api')
  return deleteTokensByScene(sceneId)
}