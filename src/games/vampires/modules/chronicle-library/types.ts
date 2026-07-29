export type LibraryChronicle = {
  id: string
  title: string
  joined_at: string
  last_opened_at: string
}

export type ChronicleChunkRow = {
  source_name: string
  document_title: string
  section_title: string
  chunk_index: number
  content: string
}

export type ChronicleDocumentChunk = {
  sectionTitle: string
  chunkIndex: number
  content: string
}

export type ChronicleDocument = {
  sourceName: string
  title: string
  markdown: string
  chunks: ChronicleDocumentChunk[]
  scope: 'official' | 'personal'
  documentId?: string
  kind?: PersonalChronicleDocumentKind
  downloadName?: string
}

export type ChronicleUploadChunk = {
  section_title: string
  content: string
}

export type ParsedChronicleUpload = {
  documentTitle: string
  chunks: ChronicleUploadChunk[]
}

export type ChronicleSearchHit = {
  sourceName: string
  documentTitle: string
  sectionTitle: string
  chunkIndex: number
  slug: string
  snippet: string
}

export type PersonalChronicleJobStatus = 'uploading' | 'processing' | 'summarizing' | 'completed' | 'failed'

export type PersonalChronicleJob = {
  id: string
  chronicle_id: string
  source_name: string
  title: string
  character_name: string
  speaker_hints: string
  status: PersonalChronicleJobStatus
  total_chunks: number
  processed_chunks: number
  source_characters: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export type PersonalChronicleJobChunk = {
  job_id: string
  chunk_index: number
  status: 'pending' | 'processing' | 'processed' | 'failed'
}

export type PersonalChronicleDocumentKind = 'clean_transcript' | 'player_chronicle'

export type PersonalChronicleDocumentRow = {
  id: string
  kind: PersonalChronicleDocumentKind
  source_name: string
  title: string
  created_at: string
}

export type PersonalChronicleDocumentChunkRow = {
  document_id: string
  section_title: string
  chunk_index: number
  content: string
}
