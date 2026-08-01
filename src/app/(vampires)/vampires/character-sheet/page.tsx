import type { Metadata } from 'next'
import CharacterSheetRoute from '@/games/vampires/modules/character-sheet/CharacterSheetRoute'

export const metadata: Metadata = {
  title: { absolute: 'Лист персонажа · Vampire: The Masquerade' },
  description: 'Цифровой лист персонажа для Vampire: The Masquerade V5',
}

export default function CharacterSheetPage() {
  return <CharacterSheetRoute />
}
