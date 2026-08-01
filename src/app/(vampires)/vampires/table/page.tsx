import type { Metadata } from 'next'
import TableRoute from '@/games/vampires/modules/table/TableRoute'

export const metadata: Metadata = {
  title: { absolute: 'Игровой стол · Vampire: The Masquerade' },
  description: 'Онлайн игровой стол для сессий Vampire: The Masquerade V5',
}

export default function TablePage() {
  return <TableRoute />
}
