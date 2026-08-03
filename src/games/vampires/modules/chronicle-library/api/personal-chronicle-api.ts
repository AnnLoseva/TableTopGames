import { createClient } from '@/games/vampires/lib/supabase'
import type {
  ChronicleDocument,
  PersonalChronicleDocumentChunkRow,
  PersonalChronicleDocumentRow,
  PersonalChronicleJob,
  PersonalChronicleJobChunk,
} from '../types'
import type { PreparedPersonalTranscript } from '../utils/personal-transcript'

function asPersonalJob(value: unknown): PersonalChronicleJob | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.chronicle_id !== 'string'
    || typeof row.source_name !== 'string' || typeof row.title !== 'string'
    || typeof row.total_chunks !== 'number' || typeof row.processed_chunks !== 'number') return null
  return row as PersonalChronicleJob
}

export async function loadPersonalChronicleJobs(): Promise<PersonalChronicleJob[]> {
  const { data, error } = await createClient()
    .from('personal_chronicle_jobs')
    .select('id, chronicle_id, source_name, title, character_name, speaker_hints, status, total_chunks, processed_chunks, source_characters, error_message, created_at, updated_at')
    .neq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(12)
  if (error) throw error
  return (Array.isArray(data) ? data : []).map(asPersonalJob).filter((job): job is PersonalChronicleJob => Boolean(job))
}

export async function loadPersonalJobChunks(jobId: string): Promise<PersonalChronicleJobChunk[]> {
  const { data, error } = await createClient()
    .from('personal_chronicle_job_chunks')
    .select('job_id, chunk_index, status')
    .eq('job_id', jobId)
    .order('chunk_index', { ascending: true })
  if (error) throw error
  return (Array.isArray(data) ? data : []) as PersonalChronicleJobChunk[]
}

export async function createPersonalChronicleJob(input: {
  chronicleId: string
  fileName: string
  characterName: string
  speakerHints: string
  transcript: PreparedPersonalTranscript
}) {
  const client = createClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw new Error('Нужен вход в аккаунт.')
  const userId = authData.user.id
  const { data, error } = await client
    .from('personal_chronicle_jobs')
    .insert({
      user_id: userId,
      chronicle_id: input.chronicleId,
      source_name: input.fileName.slice(0, 240),
      title: input.transcript.title,
      character_name: input.characterName.trim().slice(0, 160),
      speaker_hints: input.speakerHints.trim().slice(0, 1000),
      status: 'uploading',
      total_chunks: input.transcript.chunks.length,
      processed_chunks: 0,
      source_characters: input.transcript.sourceCharacters,
    })
    .select('id, chronicle_id, source_name, title, character_name, speaker_hints, status, total_chunks, processed_chunks, source_characters, error_message, created_at, updated_at')
    .single()
  if (error || !data) throw error || new Error('Не удалось создать обработку.')
  const job = asPersonalJob(data)
  if (!job) throw new Error('База вернула неизвестный формат обработки.')

  try {
    for (let offset = 0; offset < input.transcript.chunks.length; offset += 20) {
      const rows = input.transcript.chunks.slice(offset, offset + 20).map((content, index) => ({
        job_id: job.id,
        user_id: userId,
        chronicle_id: input.chronicleId,
        chunk_index: offset + index,
        raw_content: content,
        status: 'pending',
      }))
      const { error: chunkError } = await client.from('personal_chronicle_job_chunks').insert(rows)
      if (chunkError) throw chunkError
    }
    const { data: ready, error: readyError } = await client
      .from('personal_chronicle_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .select('id, chronicle_id, source_name, title, character_name, speaker_hints, status, total_chunks, processed_chunks, source_characters, error_message, created_at, updated_at')
      .single()
    if (readyError || !ready) throw readyError || new Error('Не удалось запустить обработку.')
    return asPersonalJob(ready) || job
  } catch (error) {
    await client.from('personal_chronicle_jobs').delete().eq('id', job.id)
    throw error
  }
}

export async function deletePersonalChronicleJob(jobId: string) {
  const { error } = await createClient().from('personal_chronicle_jobs').delete().eq('id', jobId)
  if (error) throw error
}

export async function invokePersonalChronicleProcessor(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke('personal-chronicle-processor', { body })
  if (error) throw error
  if (!data || data.ok !== true) throw new Error(typeof data?.message === 'string' ? data.message : 'Обработчик не ответил.')
  return data as Record<string, unknown>
}

function isDocumentRow(value: unknown): value is PersonalChronicleDocumentRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && typeof row.kind === 'string'
    && typeof row.source_name === 'string' && typeof row.title === 'string'
}

function isDocumentChunkRow(value: unknown): value is PersonalChronicleDocumentChunkRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.document_id === 'string' && typeof row.section_title === 'string'
    && typeof row.chunk_index === 'number' && typeof row.content === 'string'
}

export async function loadPersonalChronicleDocuments(chronicleId: string): Promise<ChronicleDocument[]> {
  const client = createClient()
  const [documentResult, chunkResult] = await Promise.all([
    client
      .from('personal_chronicle_documents')
      .select('id, kind, source_name, title, created_at')
      .eq('chronicle_id', chronicleId)
      .order('created_at', { ascending: false }),
    client
      .from('personal_chronicle_document_chunks')
      .select('document_id, section_title, chunk_index, content')
      .eq('chronicle_id', chronicleId)
      .order('chunk_index', { ascending: true }),
  ])
  if (documentResult.error) throw documentResult.error
  if (chunkResult.error) throw chunkResult.error
  const documents = (Array.isArray(documentResult.data) ? documentResult.data : []).filter(isDocumentRow)
  const chunks = (Array.isArray(chunkResult.data) ? chunkResult.data : []).filter(isDocumentChunkRow)

  return documents
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map(document => {
      const documentChunks = chunks
        .filter(chunk => chunk.document_id === document.id)
        .sort((left, right) => left.chunk_index - right.chunk_index)
        .map(chunk => ({ sectionTitle: chunk.section_title, chunkIndex: chunk.chunk_index, content: chunk.content }))
      return {
        sourceName: `personal:${document.id}`,
        documentId: document.id,
        title: document.title,
        scope: 'personal' as const,
        kind: document.kind,
        downloadName: document.source_name,
        chunks: documentChunks,
        markdown: `# ${document.title}\n\n${documentChunks
          .map(chunk => `## ${chunk.sectionTitle}\n\n${chunk.content}`)
          .join('\n\n')}`,
      }
    })
}
