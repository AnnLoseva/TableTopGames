import type { Metadata } from 'next'
import CreatePollRoute from '@/features/votes/routes/CreatePollRoute'

export const metadata: Metadata = {
  title: 'Голосования',
  description: 'Создайте голосование, в котором каждый распределяет свои 100% интереса между вариантами',
}

export default function VotesPage() {
  return <CreatePollRoute />
}
