import { DEFAULT_TOKEN_SIZE } from '../constants'
import type { CharacterController, CharacterToken } from '../types'

/** Scale a token so its longer side is ~maxSize while keeping the aspect ratio. */
export function calculateDefaultTokenSize(
  originalWidth: number,
  originalHeight: number,
  maxSize = DEFAULT_TOKEN_SIZE,
) {
  const safeWidth = Math.max(1, originalWidth)
  const safeHeight = Math.max(1, originalHeight)
  const scale = maxSize / Math.max(safeWidth, safeHeight)
  return {
    width: Math.max(24, Math.round(safeWidth * scale)),
    height: Math.max(24, Math.round(safeHeight * scale)),
  }
}

export function canControlCharacter(
  userId: string | null | undefined,
  characterId: string,
  assignments: CharacterController[],
  ownedCharacterIds: ReadonlySet<string> = new Set(),
): boolean {
  if (!userId) return false
  if (ownedCharacterIds.has(characterId)) return true
  return assignments.some(assignment => assignment.userId === userId && assignment.characterId === characterId)
}

export function sortTokens(tokens: CharacterToken[]) {
  return [...tokens].sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt))
}

export function upsertToken(tokens: CharacterToken[], token: CharacterToken) {
  const exists = tokens.some(item => item.id === token.id)
  const next = exists ? tokens.map(item => (item.id === token.id ? token : item)) : [...tokens, token]
  return sortTokens(next)
}
