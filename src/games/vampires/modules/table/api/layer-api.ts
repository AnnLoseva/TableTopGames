/** Table module API: canvas layers and table-images storage (table_images). */
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_IMAGE_BUCKET, TABLE_IMAGES } from '../constants'
import { mapLayerRow, toDbPatch } from '../mappers'
import type { LayerPatch, TableLayer, TableLayerRow } from '../types'
import { sortLayers } from '../utils/layer-utils'
import { safeStorageName } from '../utils/media-utils'
import { createTableId } from './scene-api'

const LAYER_SELECT = 'id, room, scene_id, layer_type, owner_role, owner_id, parent_id, name, image_data, x, y, width, height, crop_x, crop_y, crop_width, crop_height, z_index, visible, locked, opacity, blend_mode, rotation, flip_x, flip_y, brightness, contrast, saturation, on_table, is_background, created_at'

export function toLayerDbRow(layer: TableLayer) {
  return {
    id: layer.id,
    room: layer.room,
    scene_id: layer.sceneId,
    layer_type: layer.layerType,
    owner_role: layer.ownerRole,
    owner_id: layer.ownerId,
    parent_id: layer.parentId,
    name: layer.name,
    image_data: layer.imageData,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    crop_x: layer.cropX,
    crop_y: layer.cropY,
    crop_width: layer.cropWidth,
    crop_height: layer.cropHeight,
    z_index: layer.zIndex,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    blend_mode: layer.blendMode,
    rotation: layer.rotation,
    flip_x: layer.flipX,
    flip_y: layer.flipY,
    brightness: layer.brightness,
    contrast: layer.contrast,
    saturation: layer.saturation,
    on_table: layer.onTable,
    is_background: layer.isBackground,
    created_at: layer.createdAt,
  }
}

export function buildTableImageStoragePath(
  room: string,
  fileName: string,
  options: { storageFolderPath?: string; layerId?: string } = {},
) {
  const id = options.layerId || createTableId()
  const storageFolderPath = options.storageFolderPath?.trim()
  const storagePath = storageFolderPath
    ? `${room}/${storageFolderPath}/${id}-${safeStorageName(fileName)}`
    : `${room}/${id}-${safeStorageName(fileName)}`
  return { storagePath, layerId: id }
}

export async function fetchLayersForScene(room: string, sceneId: string) {
  const { data, error } = await createClient()
    .from(TABLE_IMAGES)
    .select(LAYER_SELECT)
    .eq('room', room)
    .eq('scene_id', sceneId)
    .order('z_index', { ascending: true })
    .limit(160)

  return {
    layers: data ? sortLayers(data.map(row => mapLayerRow(row as TableLayerRow))) : [],
    error,
  }
}

export async function insertLayer(layer: TableLayer) {
  return createClient().from(TABLE_IMAGES).insert(toLayerDbRow(layer))
}

export async function updateLayerRecord(layerId: string, patch: LayerPatch) {
  return createClient().from(TABLE_IMAGES).update(toDbPatch(patch)).eq('id', layerId)
}

export async function updateLayerRecords(patches: Array<{ id: string; patch: LayerPatch }>) {
  if (patches.length === 0) return []

  const supabase = createClient()
  return Promise.all(
    patches.map(item => supabase.from(TABLE_IMAGES).update(toDbPatch(item.patch)).eq('id', item.id)),
  )
}

export async function deleteLayerRecords(layerIds: string[]) {
  if (layerIds.length === 0) return { error: null }
  return createClient().from(TABLE_IMAGES).delete().in('id', layerIds)
}

export async function uploadTableImageFile(
  room: string,
  file: File,
  options: { storageFolderPath?: string; layerId?: string } = {},
) {
  const { storagePath, layerId } = buildTableImageStoragePath(room, file.name, options)
  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from(TABLE_IMAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })

  if (uploadError) {
    return { error: uploadError, publicUrl: null as string | null, storagePath, layerId }
  }

  const { data: publicUrlData } = supabase.storage.from(TABLE_IMAGE_BUCKET).getPublicUrl(storagePath)
  return { error: null, publicUrl: publicUrlData.publicUrl, storagePath, layerId }
}

export async function removeStorageObject(storagePath: string) {
  return createClient().storage.from(TABLE_IMAGE_BUCKET).remove([storagePath])
}