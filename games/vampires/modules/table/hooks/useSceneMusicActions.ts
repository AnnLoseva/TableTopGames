'use client'

import {
  createSceneMusicActions,
  type SceneMusicActionsDeps,
} from '../services/scene-music-actions'

export type { SceneMusicActionsDeps }

/** Scene music CRUD, upload, and playlist reordering. */
export function useSceneMusicActions(deps: SceneMusicActionsDeps) {
  return createSceneMusicActions(deps)
}