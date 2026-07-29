'use client'

import {
  createLayerManagerDragActions,
  type LayerManagerDragActionsDeps,
} from '../services/layer-manager-drag-actions'

export type { LayerManagerDragActionsDeps }

/** Layer panel tree drag-and-drop and folder expand/collapse. */
export function useLayerManagerDragActions(deps: LayerManagerDragActionsDeps) {
  return createLayerManagerDragActions(deps)
}