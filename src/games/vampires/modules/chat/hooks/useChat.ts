'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_CHAT_MESSAGES } from '@/games/vampires/modules/table/constants'
import { fetchCharacterById } from '@/games/vampires/modules/table/api/character-api'
import { mapCharacterRow } from '@/games/vampires/modules/table/mappers'
import type { CharacterOption } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import {
  loadChatCharactersLight,
  loadChatMessages,
  loginChatUser,
  mapChatRow,
  mergeChatMessage,
  registerChatUser,
  saveChatMessage,
} from '../api/chat-api'
import type { ChatAuthMode, ChatMessage, ChatMessageRow, ChatPanelTab, ChatUser } from '../types'

type UseChatOptions = {
  chronicleId: string
}

function readStoredChatUser(): ChatUser | null {
  const savedUser = window.localStorage.getItem('vtm-chat-user') || window.localStorage.getItem('vtm-sheet-user')
  if (!savedUser) return null

  try {
    const parsed = JSON.parse(savedUser) as ChatUser
    if (parsed?.id && parsed?.username) return parsed
  } catch {
    window.localStorage.removeItem('vtm-chat-user')
  }

  return null
}

function rememberChatUser(user: ChatUser) {
  window.localStorage.setItem('vtm-chat-user', JSON.stringify(user))
  window.localStorage.setItem('vtm-sheet-user', JSON.stringify(user))
}

function isHydratedCharacter(character?: CharacterOption | null) {
  return Boolean(character && character.hydrated !== false)
}

export function useChat({ chronicleId }: UseChatOptions) {
  const { t } = useLang()
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatMessagesLoaded, setChatMessagesLoaded] = useState(false)
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [chatCharacters, setChatCharacters] = useState<CharacterOption[]>([])
  const [selectedChatCharacterId, setSelectedChatCharacterId] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [chatUsernameDraft, setChatUsernameDraft] = useState('')
  const [chatPasswordDraft, setChatPasswordDraft] = useState('')
  const [chatAuthMode, setChatAuthMode] = useState<ChatAuthMode>('login')
  const [chatStatus, setChatStatus] = useState('Чат подключается...')
  const [isChatBusy, setIsChatBusy] = useState(false)
  const [chatPanelTab, setChatPanelTab] = useState<ChatPanelTab>('text')
  const chatChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const chatCharactersRef = useRef<CharacterOption[]>([])
  const hydrationPromisesRef = useRef<Map<string, Promise<CharacterOption | null>>>(new Map())
  const activeCharacterSelectionRef = useRef(0)

  useEffect(() => {
    const saved = readStoredChatUser()
    if (saved) setChatUser(saved)
  }, [])

  useEffect(() => {
    chatCharactersRef.current = chatCharacters
  }, [chatCharacters])

  useEffect(() => {
    let cancelled = false

    loadChatMessages(chronicleId)
      .then(messages => {
        if (cancelled) return
        setChatMessages(messages)
        setChatStatus('Чат онлайн')
        setChatMessagesLoaded(true)
      })
      .catch(error => {
        if (cancelled) return
        console.error('Не удалось загрузить чат:', error)
        setChatStatus('Нет общей истории чата')
        setChatMessagesLoaded(true)
      })

    const supabase = createClient()
    const channel = supabase
      .channel(`chronicle-chat:${chronicleId}`)
      .on('broadcast', { event: 'chat-message' }, payload => {
        const message = payload.payload as ChatMessage
        if (!message || message.room !== chronicleId) return
        setChatMessages(prev => mergeChatMessage(prev, message))
        setChatStatus('Чат онлайн')
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_CHAT_MESSAGES,
          filter: `room=eq.${chronicleId}`,
        },
        payload => {
          setChatMessages(prev => mergeChatMessage(prev, mapChatRow(payload.new as ChatMessageRow)))
          setChatStatus('Чат онлайн')
        }
      )

    chatChannelRef.current = channel
    channel.subscribe()

    return () => {
      cancelled = true
      if (chatChannelRef.current === channel) chatChannelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [chronicleId])

  const hydrateChatCharacter = useCallback(async (characterId: string): Promise<CharacterOption | null> => {
    if (!chatUser || !characterId) return null

    const existing = chatCharactersRef.current.find(character => character.id === characterId)
    if (isHydratedCharacter(existing)) return existing || null

    const inFlight = hydrationPromisesRef.current.get(characterId)
    if (inFlight) return inFlight

    const promise = (async () => {
      setChatStatus('Загружаю персонажа...')
      const { row, error } = await fetchCharacterById(characterId, { userId: chatUser.id })

      if (error || !row) {
        console.error('Не удалось дозагрузить персонажа:', error)
        setChatStatus('Персонаж не загрузился — выбери его ещё раз')
        return null
      }

      const hydrated = mapCharacterRow(row)
      setChatCharacters(current => current.map(character => (
        character.id === characterId
          ? { ...hydrated, username: character.username || hydrated.username }
          : character
      )))
      return hydrated
    })()

    hydrationPromisesRef.current.set(characterId, promise)
    try {
      return await promise
    } finally {
      if (hydrationPromisesRef.current.get(characterId) === promise) {
        hydrationPromisesRef.current.delete(characterId)
      }
    }
  }, [chatUser])

  useEffect(() => {
    if (!chatUser) {
      setChatCharacters([])
      setSelectedChatCharacterId('')
      chatCharactersRef.current = []
      hydrationPromisesRef.current.clear()
      return
    }

    let cancelled = false
    hydrationPromisesRef.current.clear()

    loadChatCharactersLight(chatUser.id)
      .then(characters => {
        if (cancelled) return

        setChatCharacters(characters)
        chatCharactersRef.current = characters
        const savedId = window.localStorage.getItem(`vtm-chat-character:${chatUser.id}:${chronicleId}`)
          || window.localStorage.getItem(`vtm-chat-character:${chatUser.id}`)
        const nextId = savedId && characters.some(character => character.id === savedId)
          ? savedId
          : characters[0]?.id || ''

        setSelectedChatCharacterId(nextId)
        if (nextId) {
          const selectionRequest = activeCharacterSelectionRef.current + 1
          activeCharacterSelectionRef.current = selectionRequest
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}:${chronicleId}`, nextId)
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, nextId)
          void hydrateChatCharacter(nextId).then(character => {
            if (cancelled || activeCharacterSelectionRef.current !== selectionRequest) return
            if (!character) {
              setSelectedChatCharacterId('')
              setChatStatus('Персонаж не загрузился — выбери его ещё раз')
              return
            }
            setChatStatus('Персонаж готов')
          })
        }
      })
      .catch(error => {
        if (cancelled) return
        console.error('Не удалось загрузить персонажей:', error)
        setChatStatus('Персонажи не загрузились')
      })

    return () => {
      cancelled = true
    }
  }, [chatUser, chronicleId, hydrateChatCharacter])

  const chooseActiveCharacter = useCallback((characterId: string) => {
    setSelectedChatCharacterId(characterId)
    if (!chatUser) return

    const selectionRequest = activeCharacterSelectionRef.current + 1
    activeCharacterSelectionRef.current = selectionRequest
    window.localStorage.setItem(`vtm-chat-character:${chatUser.id}:${chronicleId}`, characterId)
    window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, characterId)
    window.localStorage.setItem(`vtm-home-character:${chatUser.id}`, characterId)

    void hydrateChatCharacter(characterId).then(character => {
      if (activeCharacterSelectionRef.current !== selectionRequest) return
      if (!character) {
        setSelectedChatCharacterId('')
        setChatStatus('Персонаж не загрузился — выбери его ещё раз')
        return
      }
      setChatStatus('Персонаж готов')
    })
  }, [chatUser, chronicleId, hydrateChatCharacter])

  const handleChatAuth = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = chatUsernameDraft.trim()
    const password = chatPasswordDraft.trim()

    if (username.length < 3) {
      window.alert(t('Имя пользователя минимум 3 символа.'))
      return
    }
    if (password.length < 6) {
      window.alert(t('Пароль минимум 6 символов.'))
      return
    }

    setIsChatBusy(true)
    try {
      const user = chatAuthMode === 'register'
        ? await registerChatUser(username, password)
        : await loginChatUser(username, password)

      rememberChatUser(user)
      setChatUser(user)
      setChatUsernameDraft('')
      setChatPasswordDraft('')
      setChatStatus('Вход выполнен')
    } catch (error) {
      if (chatAuthMode === 'register') {
        console.error('Не удалось зарегистрировать пользователя:', error)
        const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : ''
        window.alert(code === '23505' ? t('Пользователь с таким именем уже существует.') : t('Не удалось создать аккаунт.'))
      } else {
        console.error('Не удалось войти в чат:', error)
        window.alert(t('Неверный логин или пароль.'))
      }
    } finally {
      setIsChatBusy(false)
    }
  }, [chatAuthMode, chatPasswordDraft, chatUsernameDraft, t])

  const logoutChat = useCallback(() => {
    window.localStorage.removeItem('vtm-chat-user')
    window.localStorage.removeItem('vtm-sheet-user')
    setChatUser(null)
    setChatStatus('Войди на главной, чтобы писать')
  }, [])

  const sendChatMessage = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = chatDraft.trim()
    const character = chatCharacters.find(item => item.id === selectedChatCharacterId)

    if (!chatUser) {
      window.alert(t('Войди на главной, чтобы писать в чат.'))
      return
    }
    if (!character) {
      window.alert(t('Выбери персонажа вверху справа.'))
      return
    }
    if (!isHydratedCharacter(character)) {
      setChatStatus('Персонаж ещё загружается...')
      void hydrateChatCharacter(character.id)
      window.alert(t('Персонаж ещё загружается. Попробуй снова через секунду.'))
      return
    }
    if (!text) return

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room: chronicleId,
      userId: chatUser.id,
      username: chatUser.username,
      characterId: character.id,
      characterName: character.name,
      characterImage: character.image,
      message: text,
      createdAt: new Date().toISOString(),
    }

    setChatDraft('')
    setChatMessages(prev => mergeChatMessage(prev, message))

    try {
      void chatChannelRef.current?.send({ type: 'broadcast', event: 'chat-message', payload: message })
      await saveChatMessage(message)
      setChatStatus('Чат онлайн')
    } catch (error) {
      console.error('Не удалось сохранить сообщение чата:', error)
      setChatStatus('Сообщение показано онлайн, но не сохранилось')
      window.alert(t('Сообщение отправлено в realtime, но не сохранилось. Нужно применить SQL для table_chat_messages.'))
    }
  }, [chatCharacters, chatDraft, chatUser, chronicleId, selectedChatCharacterId, t])

  return {
    chatMessages,
    setChatMessages,
    chatMessagesLoaded,
    chatStatus,
    setChatStatus,
    chatUser,
    setChatUser,
    chatCharacters,
    setChatCharacters,
    selectedChatCharacterId,
    setSelectedChatCharacterId,
    chooseActiveCharacter,
    chatAuthMode,
    setChatAuthMode,
    chatUsernameDraft,
    setChatUsernameDraft,
    chatPasswordDraft,
    setChatPasswordDraft,
    isChatBusy,
    chatPanelTab,
    setChatPanelTab,
    chatDraft,
    setChatDraft,
    handleChatAuth,
    logoutChat,
    sendChatMessage,
    hydrateChatCharacter,
  }
}
