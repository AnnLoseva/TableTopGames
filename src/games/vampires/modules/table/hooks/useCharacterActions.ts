'use client'

import { createCharacterActions, type CharacterActionsDeps } from '../services/character-actions'

export type { CharacterActionsDeps }

/** Character persistence + vitals orchestration for the table. */
export function useCharacterActions(deps: CharacterActionsDeps) {
  return createCharacterActions(deps)
}