import type { Module } from '@/platform/hub'
import type { SceneMusicTrack, TableLayer, TableScene } from '@/games/vampires/modules/table/types'

export type MasterScenesModule = Module<'master-scenes', 'vtm5'>

export type LayerCategory = 'gm' | 'fog' | 'players'

export type SceneMetaStatus = 'draft' | 'ready' | 'published' | 'archived'

export type InteractiveObjectType =
  | 'door'
  | 'light'
  | 'trap'
  | 'hotspot'
  | 'sound_trigger'
  | 'note'
  | 'custom'

export type LightPresetId = 'elysium' | 'concrete' | 'night' | 'danger' | 'neon'

/** Data-only light/mood preset — never JSX. */
export type LightMoodPreset = {
  id: LightPresetId
  label: string
  brightness: number
  contrast: number
  saturation: number
  filterCss: string
  ambience: string
}

export type MasterSceneMeta = {
  sceneId: string
  chronicleId: string
  room: string
  sortOrder: number
  archived: boolean
  encounterMarker: string
  draftLightPreset: string
  publishedLightPreset: string
  status: SceneMetaStatus
  notes: string
  updatedAt: string
}

export type SceneInteractive = {
  id: string
  chronicleId: string
  room: string
  sceneId: string
  objectType: InteractiveObjectType
  name: string
  layerId: string | null
  x: number
  y: number
  publicState: Record<string, unknown>
  privateConfig: Record<string, unknown>
  revealed: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type SceneListItem = {
  scene: TableScene
  meta: MasterSceneMeta | null
  layerCount: number
  hasMusic: boolean
  encounterMarker: string
  isPublished: boolean
  isPreview: boolean
}

export type MasterScenesViewModel = {
  scenes: SceneListItem[]
  selectedSceneId: string | null
  publishedSceneId: string | null
  layers: TableLayer[]
  music: SceneMusicTrack[]
  interactives: SceneInteractive[]
  draftPresetId: LightPresetId | ''
  publishedPresetId: LightPresetId | ''
}

export type MasterSceneMetaRow = {
  scene_id: string
  chronicle_id: string
  room: string
  sort_order: number
  archived: boolean
  encounter_marker: string
  draft_light_preset: string
  published_light_preset: string
  status: SceneMetaStatus
  notes: string
  updated_at: string
}

export type MasterSceneObjectRow = {
  id: string
  chronicle_id: string
  room: string
  scene_id: string
  object_type: InteractiveObjectType
  name: string
  layer_id: string | null
  x: number
  y: number
  public_state: unknown
  private_config: unknown
  revealed: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
