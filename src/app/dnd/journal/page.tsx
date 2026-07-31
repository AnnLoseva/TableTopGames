import type { Metadata } from 'next'
import DndJournalRoute from '@/games/dnd/journal/DndJournalRoute'

export const metadata: Metadata = {
  title: 'D&D — журнал',
  description: 'Журнал похода, синхронизированный с приложением RenaCompanion',
}

export default function DndJournal() {
  return <DndJournalRoute />
}
