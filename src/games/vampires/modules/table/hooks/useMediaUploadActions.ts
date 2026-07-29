'use client'

import { createMediaUploadActions, type MediaUploadActionsDeps } from '../services/media-upload-actions'

export type { MediaUploadActionsDeps }

/** File/url uploads into table layers and personal media library. */
export function useMediaUploadActions(deps: MediaUploadActionsDeps) {
  return createMediaUploadActions(deps)
}