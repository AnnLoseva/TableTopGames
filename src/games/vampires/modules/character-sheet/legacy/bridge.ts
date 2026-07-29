import { isCharacterSavedMessage } from './events'
import type { CharacterSheetParams, CharacterSheetRole } from './params'
import { buildLegacySheetUrl } from './params'

const CREATION_DRAFT_KEY = 'vtm-character-creation-draft-v2'

export function subscribeCharacterSaved(
  handler: (characterId: string) => void,
  expectedOrigin = typeof window !== 'undefined' ? window.location.origin : '',
) {
  const onMessage = (event: MessageEvent) => {
    if (!isCharacterSavedMessage(event.data, event.origin, expectedOrigin)) return
    handler(event.data.characterId)
  }

  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

export function replaceUrlAfterCharacterSaved(characterId: string, basePath = '/character-sheet') {
  const params = new URLSearchParams(window.location.search)
  params.delete('new')
  params.set('characterId', characterId)
  window.history.replaceState(null, '', `${basePath}?${params.toString()}`)
}

export function pushNewCharacterUrl(room: string, role: CharacterSheetRole, basePath = '/character-sheet') {
  const params = new URLSearchParams({ room, role, new: '1' })
  window.history.pushState(null, '', `${basePath}?${params.toString()}`)
}

export function clearCreationDraft(storage: Storage = window.localStorage) {
  storage.removeItem(CREATION_DRAFT_KEY)
}

export function buildSheetIframeSrc(params: CharacterSheetParams) {
  return buildLegacySheetUrl(params)
}