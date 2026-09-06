import { createVotesClient } from '../supabase'
import { MAX_OPTIONS, MIN_OPTIONS, VOTES_POLLS_TABLE, VOTES_RESPONSES_TABLE } from '../constants'
import { generateOptionId, generatePollSlug } from '../lib/slug'
import type { Poll, PollDraft, PollOption, PollResults } from '../types'

const POLL_SELECT = 'id, slug, title, description, background_image_url, options, created_at'
const UNIQUE_VIOLATION = '23505'
const MAX_SLUG_ATTEMPTS = 5

type PollRow = {
  id: string
  slug: string
  title: string
  description: string | null
  background_image_url: string | null
  options: unknown
  created_at: string
}

function mapPollOption(raw: unknown): PollOption | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  const id = candidate.id
  const label = candidate.label
  if (typeof id !== 'string' || typeof label !== 'string') return null
  const imageUrl = candidate.imageUrl ?? candidate.image_url
  return {
    id,
    label,
    imageUrl: typeof imageUrl === 'string' && imageUrl.length > 0 ? imageUrl : undefined,
  }
}

function mapPollRow(row: PollRow): Poll {
  const options = Array.isArray(row.options)
    ? row.options.map(mapPollOption).filter((option): option is PollOption => option !== null)
    : []

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    backgroundImageUrl: row.background_image_url ?? undefined,
    options,
    createdAt: row.created_at,
  }
}

export async function createPoll(draft: PollDraft): Promise<Poll> {
  const title = draft.title.trim()
  if (!title) throw new Error('Название голосования не может быть пустым')

  const options = draft.options
    .map(option => ({
      id: option.id || generateOptionId(),
      label: option.label.trim(),
      imageUrl: option.imageUrl.trim() || undefined,
    }))
    .filter(option => option.label.length > 0)

  if (options.length < MIN_OPTIONS) {
    throw new Error(`Добавьте минимум ${MIN_OPTIONS} варианта с названием`)
  }
  if (options.length > MAX_OPTIONS) {
    throw new Error(`Не больше ${MAX_OPTIONS} вариантов`)
  }

  const client = createVotesClient()

  let lastError: unknown = null
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = generatePollSlug()
    const { data, error } = await client
      .from(VOTES_POLLS_TABLE)
      .insert({
        slug,
        title,
        description: draft.description.trim(),
        background_image_url: draft.backgroundImageUrl.trim() || null,
        options,
      })
      .select(POLL_SELECT)
      .single()

    if (!error) return mapPollRow(data as PollRow)
    if (error.code !== UNIQUE_VIOLATION) throw error
    lastError = error
  }

  throw lastError instanceof Error ? lastError : new Error('Не удалось создать голосование')
}

export async function fetchPollBySlug(slug: string): Promise<Poll | null> {
  const client = createVotesClient()
  const { data, error } = await client
    .from(VOTES_POLLS_TABLE)
    .select(POLL_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ? mapPollRow(data as PollRow) : null
}

export async function submitPollResponse(
  pollId: string,
  allocations: Record<string, number>,
): Promise<string> {
  const client = createVotesClient()
  const { data, error } = await client
    .from(VOTES_RESPONSES_TABLE)
    .insert({ poll_id: pollId, allocations })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

export async function fetchPollResults(
  pollId: string,
  options: readonly PollOption[],
): Promise<PollResults> {
  const client = createVotesClient()
  const { data, error } = await client
    .from(VOTES_RESPONSES_TABLE)
    .select('allocations')
    .eq('poll_id', pollId)

  if (error) throw error

  const rows = (data ?? []) as { allocations: Record<string, number> }[]
  const totals: Record<string, number> = {}
  for (const option of options) totals[option.id] = 0

  for (const row of rows) {
    const allocations = row.allocations ?? {}
    for (const option of options) {
      totals[option.id] += Number(allocations[option.id] ?? 0)
    }
  }

  const totalResponses = rows.length
  const averages: Record<string, number> = {}
  for (const option of options) {
    averages[option.id] = totalResponses > 0 ? totals[option.id] / totalResponses : 0
  }

  return { totalResponses, averages }
}
