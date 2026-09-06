import type { Metadata } from 'next'
import PollRoute from '@/features/votes/routes/PollRoute'

type VotesPollPageProps = {
  params: Promise<{ slug: string }>
}

export const metadata: Metadata = {
  title: 'Голосование',
}

export default async function VotesPollPage({ params }: VotesPollPageProps) {
  const { slug } = await params
  return <PollRoute slug={slug} />
}
