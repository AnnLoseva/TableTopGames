import { createClient } from '@/games/vampires/lib/supabase'
import { appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import {
  activateSceneRecord,
  createTableId,
  deactivateOtherScenes,
  fetchSceneMusic,
  fetchScenes,
  insertScene,
  updateSceneRecord,
  deleteSceneWithAssets,
} from '@/games/vampires/modules/table/api/scene-api'
import {
  fetchLayersForScene,
  insertLayer,
  updateLayerRecord,
  updateLayerRecords,
} from '@/games/vampires/modules/table/api/layer-api'
import type { LayerPatch, SceneMusicTrack, TableLayer, TableScene } from '@/games/vampires/modules/table/types'
import { sortLayers } from '@/games/vampires/modules/table/utils/layer-utils'
import { upsertSceneMeta } from '../api'
import type { MasterSceneMeta, SceneListItem } from '../types'

/** Shared table channel — same as GameTable realtime. */
export async function broadcastTableEvent(room: string, event: string, payload: unknown) {
  const client = createClient()
  const channel = client.channel(`table-room:${room}`)
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => resolve(), 1200)
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout)
          resolve()
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout)
          reject(new Error(status))
        }
      })
    })
    await channel.send({ type: 'broadcast', event, payload })
  } finally {
    void client.removeChannel(channel)
  }
}

export async function loadRoomScenes(room: string): Promise<TableScene[]> {
  const { scenes, error } = await fetchScenes(room)
  if (error) throw error
  return scenes
}

export async function loadSceneLayers(room: string, sceneId: string): Promise<TableLayer[]> {
  const { layers, error } = await fetchLayersForScene(room, sceneId)
  if (error) throw error
  return sortLayers(layers)
}

export async function loadSceneTracks(room: string, sceneId: string): Promise<SceneMusicTrack[]> {
  const { tracks, error } = await fetchSceneMusic(room, sceneId)
  if (error) throw error
  return tracks
}

export function buildSceneListItems(
  scenes: readonly TableScene[],
  metaBySceneId: ReadonlyMap<string, MasterSceneMeta>,
  layerCounts: ReadonlyMap<string, number>,
  musicFlags: ReadonlyMap<string, boolean>,
  previewSceneId: string | null,
): SceneListItem[] {
  const withMeta = scenes.map(scene => {
    const meta = metaBySceneId.get(scene.id) || null
    return {
      scene,
      meta,
      layerCount: layerCounts.get(scene.id) || 0,
      hasMusic: Boolean(musicFlags.get(scene.id)),
      encounterMarker: meta?.encounterMarker || '',
      isPublished: scene.isActive,
      isPreview: scene.id === previewSceneId,
    }
  })
  return withMeta
    .filter(item => !item.meta?.archived)
    .sort((a, b) => {
      const orderA = a.meta?.sortOrder ?? 9999
      const orderB = b.meta?.sortOrder ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return a.scene.createdAt.localeCompare(b.scene.createdAt)
    })
}

export async function createMasterScene(input: {
  room: string
  name: string
  createdBy?: string | null
}): Promise<TableScene> {
  const now = new Date().toISOString()
  const existing = await loadRoomScenes(input.room)
  const scene: TableScene = {
    id: createTableId(),
    room: input.room,
    name: input.name.trim() || 'Новая сцена',
    thumbnailUrl: '',
    isActive: existing.length === 0,
    backgroundUrl: '',
    width: 1920,
    height: 1080,
    createdBy: input.createdBy || 'master',
    createdAt: now,
    updatedAt: now,
  }
  const { error } = await insertScene(scene)
  if (error) throw error
  await broadcastTableEvent(input.room, 'scene', scene).catch(() => undefined)
  return scene
}

export async function renameMasterScene(scene: TableScene, name: string): Promise<TableScene> {
  const updatedAt = new Date().toISOString()
  const next = { ...scene, name: name.trim(), updatedAt }
  const { error } = await updateSceneRecord(scene.id, { name: next.name, updated_at: updatedAt })
  if (error) throw error
  await broadcastTableEvent(scene.room, 'scene', next).catch(() => undefined)
  return next
}

export async function cloneMasterScene(input: {
  room: string
  source: TableScene
  layers: readonly TableLayer[]
  chronicleId: string
}): Promise<TableScene> {
  const clone = await createMasterScene({
    room: input.room,
    name: `${input.source.name} (копия)`,
    createdBy: input.source.createdBy,
  })
  // Clone is draft by default even if first scene would be active — demote if needed.
  if (clone.isActive && input.source.id) {
    // leave as-is if it was the only scene
  }
  for (const layer of input.layers) {
    const copy: TableLayer = {
      ...layer,
      id: createTableId(),
      sceneId: clone.id,
      name: layer.name,
      createdAt: new Date().toISOString(),
    }
    await insertLayer(copy)
  }
  await upsertSceneMeta({
    sceneId: clone.id,
    chronicleId: input.chronicleId,
    room: input.room,
    sortOrder: 999,
    archived: false,
    encounterMarker: '',
    draftLightPreset: '',
    publishedLightPreset: '',
    status: 'draft',
    notes: `Клон ${input.source.name}`,
    updatedAt: new Date().toISOString(),
  })
  return clone
}

/**
 * Publish selected preview scene to players.
 * Uses existing table_scenes.is_active + scene-active broadcast (same as GameTable).
 */
export async function publishSceneToPlayers(input: {
  room: string
  sceneId: string
  chronicleId: string
  lightPreset?: string
  meta?: MasterSceneMeta | null
}): Promise<void> {
  await deactivateOtherScenes(input.room, input.sceneId)
  const { error } = await activateSceneRecord(input.sceneId)
  if (error) throw error

  if (input.meta || input.lightPreset) {
    await upsertSceneMeta({
      sceneId: input.sceneId,
      chronicleId: input.chronicleId,
      room: input.room,
      sortOrder: input.meta?.sortOrder ?? 0,
      archived: false,
      encounterMarker: input.meta?.encounterMarker || '',
      draftLightPreset: input.meta?.draftLightPreset || input.lightPreset || '',
      publishedLightPreset: input.lightPreset || input.meta?.draftLightPreset || '',
      status: 'published',
      notes: input.meta?.notes || '',
      updatedAt: new Date().toISOString(),
    })
  }

  // Single clear realtime event — table listens for fade/switch.
  await broadcastTableEvent(input.room, 'scene-active', {
    room: input.room,
    sceneId: input.sceneId,
    fade: true,
    publishedAt: new Date().toISOString(),
  })

  try {
    await appendMasterActionLog({
      chronicleId: input.chronicleId,
      room: input.room,
      sessionId: null,
      actionType: 'scenes.publish',
      actorType: 'master',
      actorId: 'self',
      summary: `Показать игрокам: сцена ${input.sceneId}`,
      payload: {
        sceneId: input.sceneId,
        lightPreset: input.lightPreset || null,
        consequence: 'Сцена опубликована игрокам',
      },
      inversePayload: null,
      visibility: 'master',
    })
  } catch (logError) {
    console.warn('publish action log failed', logError)
  }
}

export async function archiveMasterScene(input: {
  scene: TableScene
  meta: MasterSceneMeta | null
  chronicleId: string
  hardDelete?: boolean
}): Promise<void> {
  if (input.hardDelete) {
    if (input.scene.isActive) throw new Error('Нельзя удалить опубликованную сцену. Сначала опубликуйте другую.')
    const { error } = await deleteSceneWithAssets(input.scene.id)
    if (error) throw error
    await broadcastTableEvent(input.scene.room, 'scene-delete', {
      room: input.scene.room,
      id: input.scene.id,
    }).catch(() => undefined)
    return
  }
  await upsertSceneMeta({
    sceneId: input.scene.id,
    chronicleId: input.chronicleId,
    room: input.scene.room,
    sortOrder: input.meta?.sortOrder ?? 0,
    archived: true,
    encounterMarker: input.meta?.encounterMarker || '',
    draftLightPreset: input.meta?.draftLightPreset || '',
    publishedLightPreset: input.meta?.publishedLightPreset || '',
    status: 'archived',
    notes: input.meta?.notes || '',
    updatedAt: new Date().toISOString(),
  })
}

export async function patchMasterLayer(layerId: string, patch: LayerPatch) {
  const { error } = await updateLayerRecord(layerId, patch)
  if (error) throw error
}

export async function reorderMasterLayers(orderedIds: string[]) {
  const patches = orderedIds.map((id, index) => ({
    id,
    patch: { zIndex: index + 1 } as LayerPatch,
  }))
  await updateLayerRecords(patches)
}

/** Player-safe layer filter: GM-owned layers never render for non-masters. */
export function filterPlayerVisibleLayers(layers: readonly TableLayer[], isMaster: boolean): TableLayer[] {
  if (isMaster) return [...layers]
  return layers.filter(layer => layer.ownerRole !== 'master')
}
