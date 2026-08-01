import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Загрузка книг правил · Vampire: The Masquerade' },
  description: 'Загрузка текста книг правил в базу знаний Vampire: The Masquerade V5',
}

export default function IngestBooksLayout({ children }: { children: React.ReactNode }) {
  return children
}
