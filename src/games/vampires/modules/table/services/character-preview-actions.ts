import type { Dispatch, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { fetchCharacterById, updateCharacterData } from '../api/character-api'
import { mapCharacterRow } from '../mappers'
import { tableGetDerivedStats } from '../system-runtime'
import type { ActiveParticipant, CharacterOption } from '../types'

export type CharacterPreviewActionsDeps = {
  t: (ru: string) => string
  chatUser: ChatUser | null
  chatCharacters: CharacterOption[]
  previewCharacter: CharacterOption | null
  selectedActiveCharacter: CharacterOption | null
  setPreviewCharacter: Dispatch<SetStateAction<CharacterOption | null>>
  setChatCharacters: Dispatch<SetStateAction<CharacterOption[]>>
  hydrateChatCharacter?: (characterId: string) => Promise<CharacterOption | null>
}

function buildFallbackPreview(
  t: (ru: string) => string,
  fields: {
    id?: string
    name: string
    clan?: string | null
    image?: string
    username?: string
  },
): CharacterOption {
  return {
    id: fields.id || '',
    name: fields.name,
    clan: fields.clan ?? null,
    image: fields.image || '',
    username: fields.username,
    characterType: 'vampire',
    inventory: [],
    attributes: {},
    skills: {},
    disciplines: {},
    selectedPowers: {},
    selectedPathPowers: {},
    derivedStats: tableGetDerivedStats({}, {}),
    activeEffects: [],
  }
}

export function createCharacterPreviewActions(deps: CharacterPreviewActionsDeps) {
  const openCharacterPreview = async (character: CharacterOption, username?: string) => {
    if (character.hydrated !== false) {
      deps.setPreviewCharacter({ ...character, username: username || character.username })
    }
    if (!character.id) return
    const { row, error } = await fetchCharacterById(character.id)
    if (error || !row) return
    const fresh = { ...mapCharacterRow(row), username: username || character.username }
    deps.setPreviewCharacter(fresh)
    deps.setChatCharacters(current => current.map(item => (
      item.id === fresh.id ? { ...fresh, username: item.username || fresh.username } : item
    )))
  }

  const openParticipantPreview = async (participant: ActiveParticipant) => {
    const local = deps.chatCharacters.find(character => character.id === participant.characterId)
    if (local) {
      await openCharacterPreview(local, participant.username)
      return
    }
    if (!participant.characterId) {
      deps.setPreviewCharacter(buildFallbackPreview(deps.t, {
        name: deps.t('Без персонажа'),
        username: participant.username,
      }))
      return
    }
    const { row, error } = await fetchCharacterById(participant.characterId)
    if (error || !row) {
      deps.setPreviewCharacter(buildFallbackPreview(deps.t, {
        id: participant.characterId,
        name: participant.characterName === 'без персонажа' ? deps.t('без персонажа') : participant.characterName,
        clan: participant.characterClan,
        image: participant.characterImage,
        username: participant.username,
      }))
      return
    }
    deps.setPreviewCharacter({ ...mapCharacterRow(row), username: participant.username })
  }

  const addExperienceToActiveCharacter = async () => {
    const preview = deps.previewCharacter
    const active = deps.selectedActiveCharacter
    if (!deps.chatUser || !preview?.id || preview.id !== active?.id) return
    const amount = Number(window.prompt(deps.t('Сколько опыта добавить?'), '1'))
    if (!Number.isFinite(amount) || amount <= 0) return
    const { row: data, error } = await fetchCharacterById(preview.id, {
      userId: deps.chatUser.id,
      select: 'data',
    })
    if (error || !data?.data) {
      window.alert(deps.t('Не удалось загрузить персонажа для добавления опыта.'))
      return
    }
    const characterData = data.data as Record<string, unknown>
    const current = Number(characterData.freeExp ?? characterData.experience ?? 0) || 0
    const nextData = {
      ...characterData,
      freeExp: current + amount,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(preview.id, nextData, {
      userId: deps.chatUser.id,
    })
    if (updateError) {
      window.alert(deps.t('Опыт не сохранился.'))
      return
    }
    const nextFreeExp = current + amount
    const previewId = preview.id
    deps.setPreviewCharacter(prev => (prev ? { ...prev, freeExp: nextFreeExp } : prev))
    deps.setChatCharacters(prev => prev.map(character => (
      character.id === previewId ? { ...character, freeExp: nextFreeExp } : character
    )))
  }

  return {
    openCharacterPreview,
    openParticipantPreview,
    addExperienceToActiveCharacter,
  }
}
