import type { Metadata } from 'next'
import ReferenceRoute from '@/games/vampires/modules/reference/ReferenceRoute'

export const metadata: Metadata = {
  title: { absolute: 'Справочник · Vampire: The Masquerade' },
  description: 'Справочник по правилам Vampire: The Masquerade V5',
}

export default function Reference() {
  return <ReferenceRoute />
}
