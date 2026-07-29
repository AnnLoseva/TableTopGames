export const MASTER_SCENE_META = 'master_scene_meta'
export const MASTER_SCENE_OBJECTS = 'master_scene_objects'
export const MASTER_SCENE_OBJECTS_PUBLIC = 'master_scene_objects_public'

export const SCENE_META_LOCAL_KEY = (room: string) => `vtm-master-scene-meta:${room}`
export const SCENE_OBJECTS_LOCAL_KEY = (room: string) => `vtm-master-scene-objects:${room}`
