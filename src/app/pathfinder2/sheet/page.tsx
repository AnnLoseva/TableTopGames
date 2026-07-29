import type { Metadata } from 'next'
import Pathfinder2SheetRoute from '@/games/pathfinder2/sheet/Pathfinder2SheetRoute'

export const metadata: Metadata = {
  title: 'Pathfinder 2 — создание персонажа',
  description: 'Локальный черновик персонажа Pathfinder второй редакции',
}

export default function Pathfinder2Sheet() {
  return <Pathfinder2SheetRoute />
}
