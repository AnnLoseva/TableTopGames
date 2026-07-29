'use client'

import {
  createCharacterPreviewActions,
  type CharacterPreviewActionsDeps,
} from '../services/character-preview-actions'

export type { CharacterPreviewActionsDeps }

/** Character preview modal, participant lookup, and master roll character selection. */
export function useCharacterPreviewActions(deps: CharacterPreviewActionsDeps) {
  return createCharacterPreviewActions(deps)
}