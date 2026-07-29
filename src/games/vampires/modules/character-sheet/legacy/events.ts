export const CHARACTER_SAVED_MESSAGE_TYPE = 'vtm-character-saved' as const

export type CharacterSavedMessage = {
  type: typeof CHARACTER_SAVED_MESSAGE_TYPE
  characterId: string
}

export function isCharacterSavedMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): data is CharacterSavedMessage {
  if (origin !== expectedOrigin) return false
  if (!data || typeof data !== 'object') return false
  const message = data as { type?: unknown; characterId?: unknown }
  return message.type === CHARACTER_SAVED_MESSAGE_TYPE && typeof message.characterId === 'string'
}