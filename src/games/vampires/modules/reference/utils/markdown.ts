import {
  getReferenceDocumentUrl,
  resolveWikiLink,
  type ReferenceDocument,
} from '../catalog'

export type ReferenceHeading = {
  id: string
  title: string
  level: 2 | 3
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function parseWikiLinkBody(body: string) {
  const pipeIndex = body.search(/(?<!\\)\|/)
  if (pipeIndex < 0) {
    const target = body.replace(/\\\|/g, '|').trim()
    return { target, label: target }
  }
  return {
    target: body.slice(0, pipeIndex).replace(/\\\|/g, '|').trim(),
    label: body.slice(pipeIndex + 1).replace(/\\\|/g, '|').trim(),
  }
}

function replaceWikiLinks(markdown: string, currentFile: string) {
  return markdown.replace(/\[\[([\s\S]*?)\]\]/g, (_match, body: string) => {
    const { target, label } = parseWikiLinkBody(body)
    const resolved = resolveWikiLink(currentFile, target)
    if (!resolved) return label
    const href = getReferenceDocumentUrl(resolved.slug, resolved.hash)
    return `[${label}](${href})`
  })
}

const CALLOUT_LABELS: Record<string, string> = {
  info: 'Справка',
  note: 'Заметка',
  tip: 'Совет',
  warning: 'Внимание',
}

function convertObsidianCallouts(markdown: string) {
  const lines = markdown.split(/\r?\n/)
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const calloutMatch = /^>\s*\[!([a-z]+)\]\s*(.*)$/i.exec(line)
    if (!calloutMatch) {
      output.push(line)
      continue
    }

    const kind = calloutMatch[1].toLowerCase()
    const title = calloutMatch[2].trim()
    const content: string[] = []

    while (index + 1 < lines.length && /^>\s?/.test(lines[index + 1])) {
      index += 1
      content.push(lines[index].replace(/^>\s?/, ''))
    }

    const label = CALLOUT_LABELS[kind] || kind
    output.push(`> **${label}${title ? ` · ${title}` : ''}**`)
    content.forEach(blockLine => output.push(`> ${blockLine}`))
  }

  return output.join('\n')
}

function removeFileTreeBlock(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, block => (
    block.includes('Правила Игры/') ? '' : block
  ))
}

export function preprocessReferenceMarkdown(raw: string, currentFile: string) {
  return convertObsidianCallouts(
    replaceWikiLinks(
      removeFileTreeBlock(stripFrontmatter(raw)),
      currentFile,
    ),
  )
}

export function plainHeadingText(value: string) {
  return value
    .replace(/[`*_~[\]()]/g, '')
    .replace(/#+\s*/g, '')
    .trim()
}

export function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

export function collectHeadings(markdown: string): ReferenceHeading[] {
  const slugCounts = new Map<string, number>()
  return markdown
    .split(/\r?\n/)
    .map(line => /^(#{2,3})\s+(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map(match => {
      const title = plainHeadingText(match[2])
      const baseSlug = makeSlug(title) || 'section'
      const count = slugCounts.get(baseSlug) || 0
      slugCounts.set(baseSlug, count + 1)
      return {
        id: count === 0 ? baseSlug : `${baseSlug}-${count}`,
        title,
        level: match[1].length as 2 | 3,
      }
    })
}

export function getSearchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length >= 2)
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`*_#[\]()>|~.-]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function getSearchSnippet(text: string, terms: string[]) {
  const plain = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_#[\]()>|]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = plain.toLowerCase()
  const firstIndex = terms
    .map(term => lower.indexOf(term))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, firstIndex - 90)
  const end = Math.min(plain.length, firstIndex + 210)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < plain.length ? '...' : ''
  return `${prefix}${plain.slice(start, end)}${suffix}`
}

export type ReferenceSearchHit = {
  doc: ReferenceDocument
  title: string
  level: 2 | 3
  slug: string
  snippet: string
}

export function searchReferenceCorpus(
  corpus: Array<{ doc: ReferenceDocument; markdown: string }>,
  query: string,
): ReferenceSearchHit[] {
  const terms = getSearchTerms(query)
  if (terms.length === 0) return []

  const hits: ReferenceSearchHit[] = []

  corpus.forEach(({ doc, markdown }) => {
    const lines = markdown.split(/\r?\n/)
    const blocks: Array<{ title: string; level: 2 | 3; content: string }> = []
    let current: string[] = []
    let currentTitle = ''
    let currentLevel: 2 | 3 = 2

    const flush = () => {
      if (!currentTitle) return
      blocks.push({
        title: currentTitle,
        level: currentLevel,
        content: current.join('\n').trim(),
      })
    }

    lines.forEach(line => {
      const headingMatch = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
      if (headingMatch) {
        flush()
        currentTitle = plainHeadingText(headingMatch[2])
        currentLevel = headingMatch[1].length as 2 | 3
        current = [line]
        return
      }
      if (currentTitle) current.push(line)
    })
    flush()

    const slugCounts = new Map<string, number>()
    blocks.forEach(block => {
      const haystack = normalizeSearchText(`${block.title} ${block.content}`)
      if (!terms.every(term => haystack.includes(term))) return

      const baseSlug = makeSlug(block.title) || 'section'
      const count = slugCounts.get(baseSlug) || 0
      slugCounts.set(baseSlug, count + 1)

      hits.push({
        doc,
        title: block.title,
        level: block.level,
        slug: count === 0 ? baseSlug : `${baseSlug}-${count}`,
        snippet: getSearchSnippet(block.content, terms),
      })
    })
  })

  return hits
}