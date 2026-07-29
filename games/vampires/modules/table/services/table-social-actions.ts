import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { CharacterOption, MasterWhisper } from '../types'

export type TableSocialActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  isMaster: boolean
  chatUser: ChatUser | null
  chatCharacters: CharacterOption[]
  selectedChatCharacterId: string
  masterChatDraft: string
  selectedMasterChatUserId: string
  setMasterChatDraft: Dispatch<SetStateAction<string>>
  setMasterWhispers: Dispatch<SetStateAction<MasterWhisper[]>>
  setHandNotice: Dispatch<SetStateAction<string>>
  broadcast: (event: string, payload: unknown) => void
}

export function createTableSocialActions(deps: TableSocialActionsDeps) {
  const sendMasterWhisper = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = deps.masterChatDraft.trim()
    if (!deps.chatUser || !text) return
    const targetId = deps.isMaster ? deps.selectedMasterChatUserId : null
    if (deps.isMaster && !targetId) {
      window.alert(deps.t('Выбери игрока для ответа.'))
      return
    }
    const message: MasterWhisper = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: deps.room,
      fromUserId: deps.chatUser.id,
      fromUsername: deps.chatUser.username,
      toUserId: targetId,
      message: text,
      fromMaster: deps.isMaster,
      createdAt: new Date().toISOString(),
    }
    deps.setMasterChatDraft('')
    deps.setMasterWhispers(prev => [...prev, message].slice(-160))
    deps.broadcast('master-whisper', message)
  }

  const raiseHand = () => {
    const character = deps.chatCharacters.find(item => item.id === deps.selectedChatCharacterId)
    const name = character?.name || deps.chatUser?.username || (deps.isMaster ? deps.t('Мастер') : deps.t('Игрок'))
    const payload = { room: deps.room, name, at: new Date().toISOString() }
    deps.setHandNotice(deps.tf('{name} поднял руку', { name }))
    window.setTimeout(() => deps.setHandNotice(''), 5200)
    deps.broadcast('hand-raise', payload)
  }

  return {
    sendMasterWhisper,
    raiseHand,
  }
}