'use client'

import { createLayerActions, type LayerActionsDeps } from '../services/layer-actions'

export type { LayerActionsDeps, LayerContextSnapshot } from '../services/layer-actions'

/** Layer CRUD, folders, and table placement for the canvas. */
export function useLayerActions(deps: LayerActionsDeps) {
  return createLayerActions(deps)
}