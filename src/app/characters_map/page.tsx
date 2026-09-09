import type { Metadata } from 'next'
import { Suspense } from 'react'
import CharactersMapRoute from '@/features/characters_map/routes/CharactersMapRoute'

export const metadata: Metadata = {
  title: 'Карта персонажей',
  description: 'Карта персонажей и их отношений друг с другом',
}

export default function CharactersMapPage() {
  return (
    <Suspense fallback={null}>
      <CharactersMapRoute />
    </Suspense>
  )
}
