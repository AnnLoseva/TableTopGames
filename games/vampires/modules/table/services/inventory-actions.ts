import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { InventoryCategory } from '../constants/roll-traits'
import { fetchCharacterById, updateCharacterData } from '../api/character-api'
import { normalizeInventory } from '../mappers'
import type { CharacterOption, InventoryItem, MasterReveal } from '../types'

export type InventoryActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  chatUser: ChatUser | null
  selectedActiveCharacterId: string | null
  quickInventoryName: string
  quickInventoryCategory: InventoryCategory
  quickInventoryQuantity: number
  isQuickInventoryBusy: boolean
  setQuickInventoryName: (value: string) => void
  setQuickInventoryQuantity: (value: number) => void
  setQuickInventoryStatus: (value: string) => void
  setIsQuickInventoryBusy: (value: boolean) => void
  setChatCharacters: Dispatch<SetStateAction<CharacterOption[]>>
  setPreviewCharacter: Dispatch<SetStateAction<CharacterOption | null>>
  broadcast: (event: string, payload: unknown) => void
  getPreviewCharacter: () => CharacterOption | null
}

export function createInventoryActions(deps: InventoryActionsDeps) {
  const canEditPreviewInventory = () => {
    const previewCharacter = deps.getPreviewCharacter()
    return Boolean(
      deps.chatUser
      && previewCharacter?.id
      && previewCharacter.id === deps.selectedActiveCharacterId,
    )
  }

  const addQuickInventoryItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const previewCharacter = deps.getPreviewCharacter()
    const name = deps.quickInventoryName.trim()
    if (
      !name
      || !previewCharacter?.id
      || !deps.chatUser
      || !canEditPreviewInventory()
      || deps.isQuickInventoryBusy
    ) return

    deps.setIsQuickInventoryBusy(true)
    deps.setQuickInventoryStatus('Сохраняю...')
    const now = new Date().toISOString()
    const item: InventoryItem = {
      id: `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      description: '',
      quantity: Math.max(0, Math.floor(deps.quickInventoryQuantity)),
      category: deps.quickInventoryCategory,
      note: '',
      createdAt: now,
      updatedAt: now,
      collapsed: true,
    }

    try {
      const { row: data, error } = await fetchCharacterById(previewCharacter.id, {
        userId: deps.chatUser.id,
        select: 'data',
      })
      if (error || !data?.data) throw error || new Error('Данные персонажа не найдены')

      const characterData = data.data as Record<string, unknown>
      const nextInventory = [item, ...normalizeInventory(characterData.inventory)]
      const { error: updateError } = await updateCharacterData(
        previewCharacter.id,
        { ...characterData, inventory: nextInventory, timestamp: now },
        { userId: deps.chatUser.id },
      )
      if (updateError) throw updateError

      deps.setPreviewCharacter(current => current ? { ...current, inventory: nextInventory } : current)
      deps.setChatCharacters(current => current.map(character => (
        character.id === previewCharacter.id ? { ...character, inventory: nextInventory } : character
      )))
      deps.setQuickInventoryName('')
      deps.setQuickInventoryQuantity(1)
      deps.setQuickInventoryStatus('Предмет добавлен')
    } catch (error) {
      console.error('Не удалось добавить предмет в инвентарь:', error)
      deps.setQuickInventoryStatus('Не удалось сохранить предмет')
    } finally {
      deps.setIsQuickInventoryBusy(false)
    }
  }

  const showInventoryItemToMaster = (item: InventoryItem) => {
    const previewCharacter = deps.getPreviewCharacter()
    if (!previewCharacter || !deps.chatUser) return
    const reveal: MasterReveal = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: deps.room,
      kind: deps.t('Инвентарь'),
      title: item.name || deps.t('Без названия'),
      body: item.description || item.note || deps.t('Описание не указано'),
      meta: deps.tf('{category} · {quantity} шт.', {
        category: deps.t(item.category) || deps.t('Другое'),
        quantity: item.quantity ?? 1,
      }),
      characterName: previewCharacter.name || deps.t('Безымянный'),
      userId: deps.chatUser.id,
      username: deps.chatUser.username,
      createdAt: new Date().toISOString(),
    }
    deps.broadcast('master-reveal', reveal)
    deps.setQuickInventoryStatus(deps.tf('«{title}» показано мастеру', { title: reveal.title }))
  }

  return {
    addQuickInventoryItem,
    showInventoryItemToMaster,
  }
}