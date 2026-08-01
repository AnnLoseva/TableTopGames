import type { Metadata } from 'next'
import ChronicleLibraryRoute from '@/games/vampires/modules/chronicle-library/ChronicleLibraryRoute'

export const metadata: Metadata = {
  title: { absolute: 'Библиотека хроник · Vampire: The Masquerade' },
  description: 'Библиотека хроник и материалов Vampire: The Masquerade V5',
}

export default function ChronicleLibrary() {
  return <ChronicleLibraryRoute />
}
