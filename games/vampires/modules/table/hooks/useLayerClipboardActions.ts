'use client'

import {
  createLayerClipboardActions,
  type LayerClipboardActionsDeps,
} from '../services/layer-clipboard-actions'

export type { LayerClipboardActionsDeps }

/** Layer context-menu clipboard, journal, and viewport focus helpers. */
export function useLayerClipboardActions(deps: LayerClipboardActionsDeps) {
  return createLayerClipboardActions(deps)
}