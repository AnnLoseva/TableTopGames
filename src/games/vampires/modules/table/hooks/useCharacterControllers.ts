'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import {
  deleteControllerRecord,
  fetchControllersForRoom,
  insertController,
} from '../api/controller-api'
import type { CharacterController, CharacterOption } from '../types'

export type UseCharacterControllersOptions = {
  room: string
  chatUser: ChatUser | null
  chatCharacters: CharacterOption[]
  broadcast: (event: string, payload: unknown) => void
}

/**
 * Character control assignments for the room: who may move/open which character.
 * A user always controls their own saved characters; assignments extend that.
 */
export function useCharacterControllers({ room, chatUser, chatCharacters, broadcast }: UseCharacterControllersOptions) {
  const [controllers, setControllers] = useState<CharacterController[]>([])
  const controllersRef = useRef<CharacterController[]>([])

  const loadControllers = useCallback(async () => {
    const { controllers: loaded, error } = await fetchControllersForRoom(room)
    if (error) {
      console.error('Не удалось загрузить назначения персонажей:', error)
      return
    }
    controllersRef.current = loaded
    setControllers(loaded)
  }, [room])

  useEffect(() => {
    void loadControllers()
  }, [loadControllers])

  const ownedCharacterIds = useMemo(
    () => new Set(chatCharacters.map(character => character.id)),
    [chatCharacters],
  )

  const controlledCharacterIds = useMemo(() => {
    const ids = new Set(ownedCharacterIds)
    if (chatUser) {
      controllers.forEach(controller => {
        if (controller.userId === chatUser.id) ids.add(controller.characterId)
      })
    }
    return ids
  }, [controllers, chatUser, ownedCharacterIds])

  const assignCharacter = useCallback(async (characterId: string, userId: string) => {
    const exists = controllersRef.current.some(
      controller => controller.characterId === characterId && controller.userId === userId,
    )
    if (exists) return
    const { error } = await insertController({
      room,
      characterId,
      userId,
      canMoveToken: true,
      canOpenSheet: true,
      canRollDice: true,
      canResizeToken: false,
    })
    if (error) {
      console.error('Не удалось назначить персонажа игроку:', error)
      return
    }
    await loadControllers()
    broadcast('controllers-update', { room })
  }, [room, loadControllers, broadcast])

  const unassignController = useCallback(async (controllerId: string) => {
    const { error } = await deleteControllerRecord(controllerId)
    if (error) {
      console.error('Не удалось снять назначение персонажа:', error)
      return
    }
    await loadControllers()
    broadcast('controllers-update', { room })
  }, [room, loadControllers, broadcast])

  return {
    controllers,
    controllersRef,
    controlledCharacterIds,
    ownedCharacterIds,
    loadControllers,
    assignCharacter,
    unassignController,
  }
}
