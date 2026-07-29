'use client'

import { createSceneActions, type SceneActionsDeps } from '../services/scene-actions'

export type { SceneActionsDeps }

/** Scene CRUD, activation, thumbnails, and music playback for the table. */
export function useSceneActions(deps: SceneActionsDeps) {
  return createSceneActions(deps)
}