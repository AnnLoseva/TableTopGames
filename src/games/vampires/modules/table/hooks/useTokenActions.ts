'use client'

import { createTokenActions, type TokenActionsDeps } from '../services/token-actions'

export type { TokenActionsDeps }

/** Character-token CRUD + drag sync for the game table. */
export function useTokenActions(deps: TokenActionsDeps) {
  return createTokenActions(deps)
}
