import { getSearchTerms, makeSlug, plainHeadingText } from '@/games/vampires/modules/reference/utils/markdown'
import type {
  ChronicleChunkRow,
  ChronicleDocument,
  ChronicleSearchHit,
  ChronicleUploadChunk,
  ParsedChronicleUpload,
} from '../types'

const MAX_CHUNK_LENGTH = 12_000
const DEFAULT_SECTION_TITLE = 'Вступление'

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function plainFileTitle(fileName: string) {
  return fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.(?:md|markdown|txt)$/i, '')
    .trim() || 'Хроника'
}

function cleanObsidianMarkup(markdown: string) {
  return markdown
    .replace(/!\[\[[\s\S]*?\]\]/g, '')
    .replace(/\[\[([\s\S]*?)\]\]/g, (_match, body: string) => {
      const parts = body.split(/(?<!\\)\|/)
      return (parts[1] || parts[0] || '').replace(/\\\|/g, '|').trim()
    })
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^>\s*\[!([a-z]+)\]\s*(.*)$/gim, (_match, kind: string, title: string) => (
      `> **${title.trim() || kind}**`
    ))
}

function splitOversizedContent(content: string) {
  if (content.length <= MAX_CHUNK_LENGTH) return [content]

  const paragraphs = content.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    const trimmed = current.trim()
    if (trimmed) chunks.push(trimmed)
    current = ''
  }

  paragraphs.forEach(paragraph => {
    const trimmed = paragraph.trim()
    if (!trimmed) return

    if (trimmed.length > MAX_CHUNK_LENGTH) {
      pushCurrent()
      for (let offset = 0; offset < trimmed.length; offset += MAX_CHUNK_LENGTH) {
        chunks.push(trimmed.slice(offset, offset + MAX_CHUNK_LENGTH).trim())
      }
      return
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed
    if (candidate.length > MAX_CHUNK_LENGTH) pushCurrent()
    current = current ? `${current}\n\n${trimmed}` : trimmed
  })

  pushCurrent()
  return chunks.filter(Boolean)
}

function appendSection(
  target: ChronicleUploadChunk[],
  sectionTitle: string,
  contentLines: string[],
) {
  const content = contentLines.join('\n').trim()
  if (!content) return
  const parts = splitOversizedContent(content)
  parts.forEach((part, index) => {
    target.push({
      section_title: parts.length > 1 ? `${sectionTitle} (часть ${index + 1})` : sectionTitle,
      content: part,
    })
  })
}

export function parseChronicleUpload(raw: string, fileName: string): ParsedChronicleUpload {
  const cleaned = cleanObsidianMarkup(stripFrontmatter(raw.replace(/^\uFEFF/, '')))
    .replace(/\r\n?/g, '\n')
    .trim()
  if (!cleaned) throw new Error('Файл пуст или не содержит текста.')

  const chunks: ChronicleUploadChunk[] = []
  const lines = cleaned.split('\n')
  let documentTitle = ''
  let sectionTitle = DEFAULT_SECTION_TITLE
  let sectionLines: string[] = []

  lines.forEach(line => {
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line)
    if (!heading) {
      sectionLines.push(line)
      return
    }

    const title = plainHeadingText(heading[2])
    if (!documentTitle && heading[1].length === 1) {
      documentTitle = title
      return
    }

    appendSection(chunks, sectionTitle, sectionLines)
    sectionTitle = title || DEFAULT_SECTION_TITLE
    sectionLines = []
  })

  appendSection(chunks, sectionTitle, sectionLines)
  if (chunks.length === 0) throw new Error('В файле не найден текст хроники.')
  if (chunks.length > 500) throw new Error('Файл содержит слишком много разделов.')

  return {
    documentTitle: (documentTitle || plainFileTitle(fileName)).slice(0, 240),
    chunks,
  }
}

export function isLibraryChronicle(value: unknown): value is LibraryChronicleShape {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string'
    && typeof row.title === 'string'
    && typeof row.joined_at === 'string'
    && typeof row.last_opened_at === 'string'
}

type LibraryChronicleShape = {
  id: string
  title: string
  joined_at: string
  last_opened_at: string
}

function isChronicleChunkRow(value: unknown): value is ChronicleChunkRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.source_name === 'string'
    && typeof row.document_title === 'string'
    && typeof row.section_title === 'string'
    && typeof row.chunk_index === 'number'
    && typeof row.content === 'string'
}

export function buildChronicleDocuments(values: unknown[]): ChronicleDocument[] {
  const rows = values.filter(isChronicleChunkRow)
  const grouped = new Map<string, ChronicleChunkRow[]>()
  rows.forEach(row => {
    const group = grouped.get(row.source_name) || []
    group.push(row)
    grouped.set(row.source_name, group)
  })

  return Array.from(grouped.entries()).map(([sourceName, documentRows]) => {
    const ordered = [...documentRows].sort((left, right) => left.chunk_index - right.chunk_index)
    const title = ordered[0]?.document_title || sourceName
    const chunks = ordered.map(row => ({
      sectionTitle: row.section_title || DEFAULT_SECTION_TITLE,
      chunkIndex: row.chunk_index,
      content: row.content,
    }))
    const body = chunks
      .map(chunk => `## ${chunk.sectionTitle}\n\n${chunk.content}`)
      .join('\n\n')
    return {
      sourceName,
      title,
      chunks,
      markdown: `# ${title}\n\n${body}`,
      scope: 'official' as const,
    }
  })
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`*_#[\]()>|~.-]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function getSnippet(content: string, terms: string[]) {
  const plain = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_#[\]()>|]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = plain.toLowerCase()
  const firstIndex = terms
    .map(term => lower.indexOf(term))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0
  const start = Math.max(0, firstIndex - 80)
  const end = Math.min(plain.length, firstIndex + 210)
  return `${start > 0 ? '...' : ''}${plain.slice(start, end)}${end < plain.length ? '...' : ''}`
}

export function searchChronicleDocuments(
  documents: ChronicleDocument[],
  query: string,
): ChronicleSearchHit[] {
  const terms = getSearchTerms(query)
  if (terms.length === 0) return []
  const hits: ChronicleSearchHit[] = []

  documents.forEach(document => {
    const slugCounts = new Map<string, number>()
    document.chunks.forEach(chunk => {
      const baseSlug = makeSlug(chunk.sectionTitle) || 'section'
      const count = slugCounts.get(baseSlug) || 0
      slugCounts.set(baseSlug, count + 1)
      const haystack = normalizeSearchText(`${document.title} ${chunk.sectionTitle} ${chunk.content}`)
      if (!terms.every(term => haystack.includes(term))) return

      hits.push({
        sourceName: document.sourceName,
        documentTitle: document.title,
        sectionTitle: chunk.sectionTitle,
        chunkIndex: chunk.chunkIndex,
        slug: count === 0 ? baseSlug : `${baseSlug}-${count}`,
        snippet: getSnippet(chunk.content, terms),
      })
    })
  })

  return hits
}
