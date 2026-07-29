'use client'

import { createImageEditorActions, type ImageEditorActionsDeps } from '../services/image-editor-actions'

export type { ImageEditorActionsDeps }

/** Image crop/filter editor state for table layers. */
export function useImageEditorActions(deps: ImageEditorActionsDeps) {
  return createImageEditorActions(deps)
}