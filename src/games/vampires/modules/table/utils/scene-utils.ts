import type { SceneMusicTrack, TableScene } from '../types'

export function sortScenes(scenes: TableScene[]) {
  return [...scenes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function upsertScene(scenes: TableScene[], scene: TableScene) {
  const exists = scenes.some(item => item.id === scene.id)
  return sortScenes(exists ? scenes.map(item => (item.id === scene.id ? scene : item)) : [...scenes, scene])
}

export function sortSceneMusic(tracks: SceneMusicTrack[]) {
  return [...tracks].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
}
