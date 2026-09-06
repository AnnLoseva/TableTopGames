export type PollOption = {
  id: string
  label: string
  imageUrl?: string
}

export type Poll = {
  id: string
  slug: string
  title: string
  description: string
  backgroundImageUrl?: string
  options: PollOption[]
  createdAt: string
}

export type PollOptionDraft = {
  id: string
  label: string
  imageUrl: string
}

export type PollDraft = {
  title: string
  description: string
  backgroundImageUrl: string
  options: PollOptionDraft[]
}

export type PollResults = {
  totalResponses: number
  averages: Record<string, number>
}
