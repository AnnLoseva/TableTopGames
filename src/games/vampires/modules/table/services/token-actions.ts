import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { deleteTokenRecord, insertToken, updateTokenRecord } from '../api/token-api'
import { createTableId } from '../api/scene-api'
import type { CharacterToken, TokenPatch } from '../types'
import { getMediaSize } from '../utils/media-utils'
import { calculateDefaultTokenSize, sortTokens, upsertToken } from '../utils/token-utils'

export type TokenActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  isMaster: boolean
  chatUser: ChatUser | null
  tokensRef: MutableRefObject<CharacterToken[]>
  setTokens: (next: CharacterToken[] | ((prev: CharacterToken[]) => CharacterToken[])) => void
  setSelectedTokenId: Dispatch<SetStateAction<string | null>>
  setTableStatus: Dispatch<SetStateAction<string>>
  broadcast: (event: string, payload: unknown) => void
  getActiveSceneId: () => string | null
  getSceneBounds: () => { width: number; height: number }
  canControlCharacterId: (characterId: string) => boolean
}

export function createTokenActions(deps: TokenActionsDeps) {
  const canManageToken = (token: CharacterToken) =>
    deps.isMaster || deps.canControlCharacterId(token.characterId)

  /** Same rule as move: the master or the controlling player may resize a token. */
  const canResizeToken = (token: CharacterToken) => canManageToken(token)

  /** One active token per character per scene: re-select the existing one instead of duplicating. */
  const addCharacterToken = async (character: {
    id: string
    name: string
    image: string
  }) => {
    const sceneId = deps.getActiveSceneId()
    if (!sceneId) {
      window.alert(deps.t('Сначала нужна активная сцена.'))
      return null
    }
    if (!deps.isMaster && !deps.canControlCharacterId(character.id)) return null

    const existing = deps.tokensRef.current.find(
      token => token.characterId === character.id && token.sceneId === sceneId,
    )
    if (existing) {
      deps.setSelectedTokenId(existing.id)
      return existing.id
    }

    let natural = { width: 1, height: 1 }
    if (character.image) {
      try {
        natural = await getMediaSize(character.image, 'image')
      } catch {
        natural = { width: 1, height: 1 }
      }
    }
    const size = calculateDefaultTokenSize(natural.width, natural.height)
    const bounds = deps.getSceneBounds()
    const siblingShift = (deps.tokensRef.current.length % 5) * 24
    const maxZ = deps.tokensRef.current.reduce((max, token) => Math.max(max, token.zIndex), 0)
    const now = new Date().toISOString()
    const token: CharacterToken = {
      id: createTableId(),
      room: deps.room,
      sceneId,
      characterId: character.id,
      characterName: character.name,
      imageUrl: character.image,
      ownerUserId: deps.isMaster ? null : deps.chatUser?.id ?? null,
      x: Math.round(bounds.width / 2 - size.width / 2 + siblingShift),
      y: Math.round(bounds.height / 2 - size.height / 2 + siblingShift),
      width: size.width,
      height: size.height,
      zIndex: maxZ + 1,
      createdAt: now,
      updatedAt: now,
    }

    deps.setTokens(prev => upsertToken(prev, token))
    deps.setSelectedTokenId(token.id)
    deps.broadcast('token', token)

    const { error } = await insertToken(token)
    if (error) {
      console.error('Не удалось сохранить токен:', error)
      deps.setTableStatus('Токен показан онлайн, но не сохранён')
    }
    return token.id
  }

  const patchToken = async (tokenId: string, patch: TokenPatch) => {
    const token = deps.tokensRef.current.find(item => item.id === tokenId)
    if (!token || !canManageToken(token)) return

    deps.setTokens(prev => sortTokens(prev.map(item => (
      item.id === tokenId ? { ...item, ...patch } : item
    ))))
    deps.broadcast('token-update', { id: tokenId, room: deps.room, patch })

    const { error } = await updateTokenRecord(tokenId, patch)
    if (error) {
      console.error('Не удалось обновить токен:', error)
      deps.setTableStatus('Токен не сохранился')
    }
  }

  const bringTokenToFront = async (tokenId: string) => {
    const token = deps.tokensRef.current.find(item => item.id === tokenId)
    if (!token || !canManageToken(token)) return
    const isTopmost = deps.tokensRef.current.every(item => item.id === tokenId || item.zIndex < token.zIndex)
    if (isTopmost) return
    const maxZ = deps.tokensRef.current.reduce((max, item) => Math.max(max, item.zIndex), 0)
    await patchToken(tokenId, { zIndex: maxZ + 1 })
  }

  const deleteToken = async (tokenId: string, options: { confirm?: boolean } = { confirm: true }) => {
    const token = deps.tokensRef.current.find(item => item.id === tokenId)
    if (!token || !canManageToken(token)) return
    if (options.confirm && !window.confirm(deps.tf('Убрать токен "{name}" со стола?', { name: token.characterName || deps.t('Безымянный') }))) return

    deps.setTokens(prev => prev.filter(item => item.id !== tokenId))
    deps.setSelectedTokenId(prev => (prev === tokenId ? null : prev))
    deps.broadcast('token-delete', { id: tokenId, room: deps.room })

    const { error } = await deleteTokenRecord(tokenId)
    if (error) {
      console.error('Не удалось удалить токен:', error)
      deps.setTableStatus('Токен не удалился')
    }
  }

  return {
    canManageToken,
    canResizeToken,
    addCharacterToken,
    patchToken,
    bringTokenToFront,
    deleteToken,
  }
}
