import { createClient } from '@/games/vampires/lib/supabase'
import { CHARACTERS, TABLE_CHAT_MESSAGES } from '@/games/vampires/modules/table/constants'
import { mapCharacterRow } from '@/games/vampires/modules/table/mappers'
import type { CharacterOption } from '@/games/vampires/modules/table/types'
import type { ChatMessage, ChatMessageRow, ChatUser } from '../types'

type ChatCharacterLightRow = {
  id: string
  name: string
  clan: string | null
  image: string | null
}

export function hashChatPassword(password: string) {
  try {
    return window.btoa(password)
  } catch {
    return window.btoa(unescape(encodeURIComponent(password)))
  }
}

export function mapChatRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    room: row.room,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    characterImage: row.character_image || '',
    message: row.message,
    createdAt: row.created_at,
  }
}

export function toChatMessageRow(message: ChatMessage) {
  return {
    id: message.id,
    room: message.room,
    user_id: message.userId,
    username: message.username,
    character_id: message.characterId,
    character_name: message.characterName,
    character_image: message.characterImage,
    message: message.message,
    created_at: message.createdAt,
  }
}

export function mergeChatMessage(messages: ChatMessage[], message: ChatMessage) {
  if (messages.some(item => item.id === message.id)) return messages
  return [...messages, message]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-120)
}

export async function loadChatMessages(chronicleId: string) {
  const { data, error } = await createClient()
    .from(TABLE_CHAT_MESSAGES)
    .select('id, room, user_id, username, character_id, character_name, character_image, message, created_at')
    .eq('room', chronicleId)
    .order('created_at', { ascending: false })
    .limit(120)

  if (error) throw error
  return (data || []).map(row => mapChatRow(row as ChatMessageRow)).reverse()
}

export async function saveChatMessage(message: ChatMessage) {
  const { error } = await createClient().from(TABLE_CHAT_MESSAGES).insert(toChatMessageRow(message))
  if (error) throw error
}

export async function loadChatCharacters(userId: string): Promise<CharacterOption[]> {
  return loadChatCharactersLight(userId)
}

export async function loadChatCharactersLight(userId: string): Promise<CharacterOption[]> {
  const { data, error } = await createClient()
    .from(CHARACTERS)
    .select('id, name, clan, image:data->>characterImage')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(row => {
    const character = row as ChatCharacterLightRow
    return {
      ...mapCharacterRow({
        id: character.id,
        name: character.name,
        clan: character.clan,
        data: { characterImage: character.image || '' },
      }),
      image: character.image || '',
      hydrated: false,
    }
  })
}

export async function registerChatUser(username: string, password: string): Promise<ChatUser> {
  const { data, error } = await createClient()
    .from('users')
    .insert({ username, password_hash: hashChatPassword(password) })
    .select('id, username')
    .single()

  if (error || !data) throw error || new Error('Chat user was not created')
  return data as ChatUser
}

export async function loginChatUser(username: string, password: string): Promise<ChatUser> {
  const { data, error } = await createClient()
    .from('users')
    .select('id, username')
    .eq('username', username)
    .eq('password_hash', hashChatPassword(password))
    .single()

  if (error || !data) throw error || new Error('Chat user was not found')
  return data as ChatUser
}
