import type { Metadata } from 'next'
import MasterConsoleRoute from '@/games/vampires/modules/master-console/MasterConsoleRoute'

export const metadata: Metadata = {
  title: { absolute: 'Мастерская консоль · Vampire: The Masquerade' },
  description: 'Консоль мастера для управления хроникой Vampire: The Masquerade V5',
}

export default function MasterPage() {
  return <MasterConsoleRoute />
}
