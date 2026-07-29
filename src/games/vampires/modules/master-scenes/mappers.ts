import type {
  MasterSceneMeta,
  MasterSceneMetaRow,
  MasterSceneObjectRow,
  SceneInteractive,
} from './types'

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function mapSceneMetaRow(row: MasterSceneMetaRow): MasterSceneMeta {
  return {
    sceneId: row.scene_id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sortOrder: row.sort_order,
    archived: row.archived,
    encounterMarker: row.encounter_marker,
    draftLightPreset: row.draft_light_preset,
    publishedLightPreset: row.published_light_preset,
    status: row.status,
    notes: row.notes,
    updatedAt: row.updated_at,
  }
}

export function toSceneMetaRow(meta: MasterSceneMeta): MasterSceneMetaRow {
  return {
    scene_id: meta.sceneId,
    chronicle_id: meta.chronicleId,
    room: meta.room,
    sort_order: meta.sortOrder,
    archived: meta.archived,
    encounter_marker: meta.encounterMarker,
    draft_light_preset: meta.draftLightPreset,
    published_light_preset: meta.publishedLightPreset,
    status: meta.status,
    notes: meta.notes,
    updated_at: meta.updatedAt,
  }
}

export function mapSceneObjectRow(row: MasterSceneObjectRow): SceneInteractive {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sceneId: row.scene_id,
    objectType: row.object_type,
    name: row.name,
    layerId: row.layer_id,
    x: row.x,
    y: row.y,
    publicState: objectValue(row.public_state),
    privateConfig: objectValue(row.private_config),
    revealed: row.revealed,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toSceneObjectRow(object: SceneInteractive): MasterSceneObjectRow {
  return {
    id: object.id,
    chronicle_id: object.chronicleId,
    room: object.room,
    scene_id: object.sceneId,
    object_type: object.objectType,
    name: object.name,
    layer_id: object.layerId,
    x: object.x,
    y: object.y,
    public_state: object.publicState,
    private_config: object.privateConfig,
    revealed: object.revealed,
    sort_order: object.sortOrder,
    created_at: object.createdAt,
    updated_at: object.updatedAt,
  }
}
