export type CharacterSheetRole = 'master' | 'player'

export type CharacterSheetParams = {
  room: string
  role: CharacterSheetRole
  characterId: string
  isNewCharacter: boolean
}

const DEFAULT_ROOM = 'campaign-666'

export function readCharacterSheetParams(search = '', storage?: Storage | null): CharacterSheetParams {
  const params = new URLSearchParams(search)
  const isNewCharacter = params.get('new') === '1'
  const room = params.get('room') || storage?.getItem('vtm-table-room') || DEFAULT_ROOM
  const requestedRole = params.get('role')
  const savedRole = storage?.getItem('vtm-table-role')
  let role: CharacterSheetRole = 'player'

  if (requestedRole === 'master' || requestedRole === 'player') role = requestedRole
  else if (savedRole === 'master' || savedRole === 'player') role = savedRole

  return {
    room,
    role,
    characterId: isNewCharacter ? '' : params.get('characterId') || '',
    isNewCharacter,
  }
}

export function buildLegacySheetUrl(params: CharacterSheetParams) {
  const query = new URLSearchParams({ room: params.room, role: params.role })
  if (params.characterId) query.set('characterId', params.characterId)
  if (params.isNewCharacter) query.set('new', '1')
  return `/vampires/old-sheet.html?${query.toString()}`
}

export function buildTableHref(room: string, role: CharacterSheetRole) {
  return `/table?room=${encodeURIComponent(room)}&role=${role}`
}

export function rememberSheetNavigation(room: string, role: CharacterSheetRole, storage: Storage) {
  storage.setItem('vtm-table-room', room)
  storage.setItem('vtm-table-role', role)
}