'use client'

import { useEffect, useRef } from 'react'
import type { ChatMessage, ChatUser } from '@/games/vampires/modules/chat/types'
import type { RollMessage } from '../types'
import {
  playNotificationTone,
  startTabBlink,
  stopTabBlink,
  unlockNotificationAudio,
} from '../utils/notification-alerts'

export type UseTableAlertsOptions = {
  rolls: RollMessage[]
  rollsStatus: 'loading' | 'ok' | 'error'
  chatMessages: ChatMessage[]
  chatMessagesLoaded: boolean
  chatUser: ChatUser | null
  t: (ru: string) => string
}

export function useTableAlerts({
  rolls,
  rollsStatus,
  chatMessages,
  chatMessagesLoaded,
  chatUser,
  t,
}: UseTableAlertsOptions) {
  const rollBaselineRef = useRef<Set<string> | null>(null)
  const messageBaselineRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    window.addEventListener('pointerdown', unlockNotificationAudio)
    window.addEventListener('keydown', unlockNotificationAudio)
    return () => {
      window.removeEventListener('pointerdown', unlockNotificationAudio)
      window.removeEventListener('keydown', unlockNotificationAudio)
    }
  }, [])

  useEffect(() => {
    const stopBlinkIfVisible = () => {
      if (!document.hidden) stopTabBlink()
    }
    window.addEventListener('focus', stopBlinkIfVisible)
    document.addEventListener('visibilitychange', stopBlinkIfVisible)
    return () => {
      window.removeEventListener('focus', stopBlinkIfVisible)
      document.removeEventListener('visibilitychange', stopBlinkIfVisible)
      stopTabBlink()
    }
  }, [])

  useEffect(() => {
    if (rollsStatus === 'loading') return
    const baseline = rollBaselineRef.current
    const nextIds = new Set(rolls.map(roll => roll.id))

    if (!baseline) {
      rollBaselineRef.current = nextIds
      return
    }
    rollBaselineRef.current = nextIds
    if (!rolls.some(roll => !baseline.has(roll.id))) return

    playNotificationTone('roll')
    if (document.hidden) startTabBlink(t('🎲 Новый бросок!'))
  }, [rolls, rollsStatus, t])

  useEffect(() => {
    if (!chatMessagesLoaded) return
    const baseline = messageBaselineRef.current
    const nextIds = new Set(chatMessages.map(message => message.id))

    if (!baseline) {
      messageBaselineRef.current = nextIds
      return
    }
    messageBaselineRef.current = nextIds
    const hasNewIncomingMessage = chatMessages.some(message => !baseline.has(message.id) && message.userId !== chatUser?.id)
    if (!hasNewIncomingMessage) return

    playNotificationTone('message')
    if (document.hidden) startTabBlink(t('💬 Новое сообщение!'))
  }, [chatMessages, chatMessagesLoaded, chatUser, t])
}
