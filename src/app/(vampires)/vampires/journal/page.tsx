import type { Metadata } from 'next'
import JournalRoute from '@/games/vampires/modules/journal/JournalRoute'

export const metadata: Metadata = {
  title: { absolute: 'Хроника · Vampire: The Masquerade' },
  description: 'Дневник хроники и журнал событий для Vampire: The Masquerade V5',
}

export default function Journal() {
  return <JournalRoute />
}
