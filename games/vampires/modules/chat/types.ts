import type { Module } from '@/core/hub'

export type ChatModule = Module<'chat', 'vtm5'>

export type ChatUser = {
  id: string
  username: string
}

export type ChatMessage = {
  id: string
  room: string
  userId: string
  username: string
  characterId: string | null
  characterName: string
  characterImage: string
  message: string
  createdAt: string
}

export type ChatMessageRow = {
  id: string
  room: string
  user_id: string
  username: string
  character_id: string | null
  character_name: string
  character_image: string | null
  message: string
  created_at: string
}

export type ChatPanelTab = 'text' | 'voice'

export type ChatAuthMode = 'login' | 'register'
