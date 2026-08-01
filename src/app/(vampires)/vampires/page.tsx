import type { Metadata } from 'next'
import HomeRoute from '@/games/vampires/modules/home/HomeRoute'

export const metadata: Metadata = {
  title: { absolute: 'Vampire: The Masquerade' },
  description: 'Цифровой лист персонажа и игровой стол для Vampire: The Masquerade V5',
}

export default function HomePage() {
  return <HomeRoute />
}
