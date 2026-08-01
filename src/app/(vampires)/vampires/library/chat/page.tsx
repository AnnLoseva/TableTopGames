import type { Metadata } from 'next'
import { RulesChatPage } from '@/games/vampires/modules/rules-chat'

export const metadata: Metadata = {
  title: { absolute: 'Правила — чат · Vampire: The Masquerade' },
  description: 'Чат с ассистентом по правилам Vampire: The Masquerade V5',
}

export default function LibraryChatPage() {
  return <RulesChatPage />
}
