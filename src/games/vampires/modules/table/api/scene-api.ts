/** Table module API: scenes, session folders and per-scene music tracks (table_scenes, table_scene_folders, table_scene_music). */
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_IMAGES, TABLE_SCENE_FOLDERS, TABLE_SCENE_MUSIC, TABLE_SCENES } from '../constants'
import { mapSceneFolderRow, mapSceneMusicRow, mapSceneRow } from '../mappers'
import type { SceneMusicRow, SceneMusicTrack, TableLayer, TableScene, TableSceneFolder, TableSceneFolderRow, TableSceneRow } from '../types'
import { sortSceneMusic, sortScenes } from '../utils/scene-utils'

const SCENE_SELECT = 'id, room, name, thumbnail_url, is_active, background_url, width, height, folder_id, view_mode, created_by, created_at, updated_at'
const SCENE_MUSIC_SELECT = 'id, room, scene_id, title, url, source_type, order_index, is_default, autoplay, created_at, updated_at'
const SCENE_FOLDER_SELECT = 'id, room, name, order_index, created_at, updated_at'

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
    folder_id: scene.folderId,
    view_mode: scene.viewMode,
    created_by: scene.createdBy,
    created_at: scene.createdAt,
    updated_at: scene.updatedAt,
  }
}

export function toSceneFolderDbRow(folder: TableSceneFolder) {
  return {
    id: folder.id,
    room: folder.room,
    name: folder.name,
    order_index: folder.orderIndex,
    created_at: folder.createdAt,
    updated_at: folder.updatedAt,
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
    folder_id?: string | null
    view_mode?: 'table' | 'free'
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

export async function fetchSceneFolders(room: string) {
  const { data, error } = await createClient()
    .from(TABLE_SCENE_FOLDERS)
    .select(SCENE_FOLDER_SELECT)
    .eq('room', room)
    .order('order_index', { ascending: true })

  return {
    folders: data ? data.map(row => mapSceneFolderRow(row as TableSceneFolderRow)) : [],
    error,
  }
}

export async function insertSceneFolder(folder: TableSceneFolder) {
  return createClient().from(TABLE_SCENE_FOLDERS).insert(toSceneFolderDbRow(folder))
}

export async function updateSceneFolderRecord(
  folderId: string,
  patch: { name?: string; order_index?: number; updated_at: string },
) {
  return createClient().from(TABLE_SCENE_FOLDERS).update(patch).eq('id', folderId)
}

export async function deleteSceneFolderRecord(folderId: string) {
  return createClient().from(TABLE_SCENE_FOLDERS).delete().eq('id', folderId)
}

/**
 * Deep-clones a scene (new id) plus its layers, tokens and scene music into
 * an independent copy, optionally into a different folder. The original is
 * left untouched.
 */
export async function copySceneDeep(source: TableScene, folderId: string | null) {
  const now = new Date().toISOString()
  const newSceneId = createTableId()
  const newScene: TableScene = {
    ...source,
    id: newSceneId,
    name: `${source.name} (копия)`,
    isActive: false,
    folderId,
    createdAt: now,
    updatedAt: now,
  }
  const { error: sceneError } = await insertScene(newScene)
  if (sceneError) return { scene: null, error: sceneError }

  const rollbackCopy = async (error: unknown) => {
    const { error: rollbackError } = await deleteSceneWithAssets(newSceneId)
    if (rollbackError) console.error('Не удалось откатить неполную копию сцены:', rollbackError)
    return { scene: null, error }
  }

  const { fetchLayersForScene, insertLayer } = await import('./layer-api')
  const { layers, error: layersFetchError } = await fetchLayersForScene(source.room, source.id)
  if (layersFetchError) return rollbackCopy(layersFetchError)
  const layerIdMap = new Map<string, string>(layers.map(layer => [layer.id, createTableId()]))
  const layersById = new Map(layers.map(layer => [layer.id, layer]))
  const layerDepth = (layer: TableLayer, visited = new Set<string>()): number => {
    if (!layer.parentId || visited.has(layer.id)) return 0
    const parent = layersById.get(layer.parentId)
    if (!parent) return 0
    visited.add(layer.id)
    return 1 + layerDepth(parent, visited)
  }
  const parentFirstLayers = [...layers].sort((left, right) => layerDepth(left) - layerDepth(right))
  for (const layer of parentFirstLayers) {
    const clonedId = layerIdMap.get(layer.id) as string
    const clonedParentId = layer.parentId ? layerIdMap.get(layer.parentId) || null : null
    const { error: layerError } = await insertLayer({
      ...layer,
      id: clonedId,
      sceneId: newSceneId,
      parentId: clonedParentId,
      createdAt: now,
    })
    if (layerError) return rollbackCopy(layerError)
  }

  const { fetchTokensForScene, insertToken } = await import('./token-api')
  const { tokens, error: tokensFetchError } = await fetchTokensForScene(source.room, source.id)
  if (tokensFetchError) return rollbackCopy(tokensFetchError)
  for (const token of tokens) {
    const { error: tokenError } = await insertToken({
      ...token,
      id: createTableId(),
      sceneId: newSceneId,
      createdAt: now,
      updatedAt: now,
    })
    if (tokenError) return rollbackCopy(tokenError)
  }

  const { tracks, error: tracksFetchError } = await fetchSceneMusic(source.room, source.id)
  if (tracksFetchError) return rollbackCopy(tracksFetchError)
  for (const track of tracks) {
    const { error: trackError } = await insertSceneMusic({
      ...track,
      id: createTableId(),
      sceneId: newSceneId,
      createdAt: now,
      updatedAt: now,
    })
    if (trackError) return rollbackCopy(trackError)
  }

  return { scene: newScene, error: null }
}
