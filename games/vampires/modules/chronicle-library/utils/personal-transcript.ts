export const MAX_PERSONAL_TRANSCRIPT_BYTES = 8_000_000
export const MAX_PERSONAL_TRANSCRIPT_CHUNKS = 600
export const PERSONAL_TRANSCRIPT_CHUNK_LENGTH = 14_000

export type PreparedPersonalTranscript = {
  title: string
  sourceCharacters: number
  chunks: string[]
}

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.(?:md|markdown|txt|srt|vtt)$/i, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*\[[^\]]+\]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Личная хроника'
}

function splitLongParagraph(paragraph: string) {
  const pieces: string[] = []
  let remaining = paragraph.trim()
  while (remaining.length > PERSONAL_TRANSCRIPT_CHUNK_LENGTH) {
    const window = remaining.slice(0, PERSONAL_TRANSCRIPT_CHUNK_LENGTH + 1)
    const sentenceBreak = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('… '),
    )
    const wordBreak = window.lastIndexOf(' ')
    const splitAt = sentenceBreak >= PERSONAL_TRANSCRIPT_CHUNK_LENGTH * 0.55
      ? sentenceBreak + 1
      : wordBreak > 0 ? wordBreak : PERSONAL_TRANSCRIPT_CHUNK_LENGTH
    pieces.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }
  if (remaining) pieces.push(remaining)
  return pieces
}

function normalizeSubtitleParagraphs(raw: string) {
  const normalized = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^WEBVTT[^\n]*\n/i, '')
  const hasTimings = /\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/m.test(normalized)
  const paragraphs: string[] = []
  let current = ''

  const flush = () => {
    const clean = current.replace(/\s+/g, ' ').trim()
    if (clean) paragraphs.push(clean)
    current = ''
  }

  normalized.split('\n').forEach(sourceLine => {
    const trimmed = sourceLine.trim()
    if (!trimmed) {
      flush()
      return
    }
    if (/^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/.test(trimmed)) return
    if (hasTimings && /^\d+$/.test(trimmed)) return
    if (/^(?:NOTE|STYLE|REGION)(?:\s|$)/i.test(trimmed)) return

    const line = trimmed
      .replace(/<\/?(?:c|v|lang)(?:\.[^ >]+|\s+[^>]*)?>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!line) return
    if (/^>>\s*/.test(line)) {
      flush()
      current = `>> ${line.replace(/^>>\s*/, '')}`
      return
    }
    current = current ? `${current} ${line}` : line
  })
  flush()
  return paragraphs
}

function packParagraphs(paragraphs: string[]) {
  const chunks: string[] = []
  let current = ''
  const push = () => {
    const clean = current.trim()
    if (clean) chunks.push(clean)
    current = ''
  }

  paragraphs.flatMap(splitLongParagraph).forEach(paragraph => {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length > PERSONAL_TRANSCRIPT_CHUNK_LENGTH) push()
    current = current ? `${current}\n\n${paragraph}` : paragraph
  })
  push()
  return chunks
}

export function preparePersonalTranscript(raw: string, fileName: string): PreparedPersonalTranscript {
  const paragraphs = normalizeSubtitleParagraphs(raw)
  const chunks = packParagraphs(paragraphs)
  if (chunks.length === 0) throw new Error('Файл пуст или не содержит распознаваемого текста.')
  if (chunks.length > MAX_PERSONAL_TRANSCRIPT_CHUNKS) {
    throw new Error('Файл слишком большой для одной обработки. Разделите его по игровым сессиям.')
  }
  return {
    title: titleFromFileName(fileName).slice(0, 240),
    sourceCharacters: raw.length,
    chunks,
  }
}
