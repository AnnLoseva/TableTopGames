'use client'

import {
  createCharacterPreviewActions,
  type CharacterPreviewActionsDeps,
} from '../services/character-preview-actions'

export type { CharacterPreviewActionsDeps }

/** Character preview modal and participant lookup. */
export function useCharacterPreviewActions(deps: CharacterPreviewActionsDeps) {
  return createCharacterPreviewActions(deps)
}