import type { TableRole } from '../types'

export function getCharacterSheetHref(
  room: string,
  tableRole: TableRole | null,
  characterId?: string | null,
) {
  const params = new URLSearchParams({ room })
  if (tableRole) params.set('role', tableRole)
  if (characterId) params.set('characterId', characterId)
  return `/character-sheet?${params.toString()}`
}