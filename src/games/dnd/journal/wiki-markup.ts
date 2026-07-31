// Wiki-link and image-embed helpers shared by the D&D journal preview.
// Mirrors the RenaCompanion app conventions:
//   [[Page title]]   → navigable wiki link (title or alias)
//   ![[Image name]]  → embedded journal image (resolved by display name)
//
// Pure TypeScript — no React / Supabase — so unit tests stay trivial.

import type { DndJournalImage, DndJournalPage } from './types'

/** Case-insensitive title/alias match, same rules as the iPad journal. */
export function findPageByWikiTitle(
  pages: readonly DndJournalPage[],
  title: string,
): DndJournalPage | undefined {
  const needle = title.trim()
  if (!needle) return undefined
  return pages.find(page => {
    if (page.isArchived) return false
    const names = [page.title, ...page.aliases]
    return names.some(name => name.localeCompare(needle, undefined, { sensitivity: 'accent' }) === 0)
  })
}

/** Case-insensitive image name match (global gallery, not page-scoped). */
export function findImageByName(
  images: readonly DndJournalImage[],
  name: string,
): DndJournalImage | undefined {
  const needle = name.trim()
  if (!needle) return undefined
  return images.find(
    image => image.name.localeCompare(needle, undefined, { sensitivity: 'accent' }) === 0,
  )
}

export type WikiToken =
  | { kind: 'text'; value: string }
  | { kind: 'page'; title: string }
  | { kind: 'image'; name: string }

const INLINE_TOKEN_RE = /!\[\[([^\]\n]+)\]\]|\[\[([^\]\n]+)\]\]/g

/** Split a single line into plain text, page links and inline image labels. */
export function tokenizeInline(line: string): WikiToken[] {
  const tokens: WikiToken[] = []
  let cursor = 0
  INLINE_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_TOKEN_RE.exec(line)) !== null) {
    if (match.index > cursor) {
      tokens.push({ kind: 'text', value: line.slice(cursor, match.index) })
    }
    if (match[1] !== undefined) {
      tokens.push({ kind: 'image', name: match[1].trim() })
    } else if (match[2] !== undefined) {
      tokens.push({ kind: 'page', title: match[2].trim() })
    }
    cursor = match.index + match[0].length
  }
  if (cursor < line.length) {
    tokens.push({ kind: 'text', value: line.slice(cursor) })
  }
  if (tokens.length === 0) {
    tokens.push({ kind: 'text', value: line })
  }
  return tokens
}

/**
 * A line is a standalone image embed when it is only `![[name]]`
 * (optional surrounding whitespace) — the app renders these full-width.
 */
export function standaloneImageName(line: string): string | null {
  const trimmed = line.trim()
  const match = /^!\[\[([^\]\n]+)\]\]$/.exec(trimmed)
  if (!match?.[1]) return null
  return match[1].trim()
}

/**
 * Convert wiki tokens into ordinary GFM markdown so we can still use
 * `react-markdown` for headings, lists, bold, etc.
 *
 *   [[Title]]     → [Title](dnd-page:Title)
 *   ![[name]]     → ![name](dnd-image:name)
 *
 * Standalone image lines are left as-is for the block-level renderer.
 */
export function wikiToMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  return lines
    .map(line => {
      if (standaloneImageName(line) !== null) {
        // Keep a sentinel the block renderer can still recognise after
        // markdown processing is skipped for these lines.
        return line
      }
      return line.replace(INLINE_TOKEN_RE, (_full, imageName: string | undefined, pageTitle: string | undefined) => {
        if (imageName !== undefined) {
          const name = imageName.trim()
          return `![${escapeMarkdownLabel(name)}](dnd-image:${encodeURIComponent(name)})`
        }
        const title = (pageTitle ?? '').trim()
        return `[${escapeMarkdownLabel(title)}](dnd-page:${encodeURIComponent(title)})`
      })
    })
    .join('\n')
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/[[\]()]/g, '\\$&')
}

export function decodeWikiHref(href: string | undefined, scheme: 'dnd-page' | 'dnd-image'): string | null {
  if (!href) return null
  const prefix = `${scheme}:`
  if (!href.startsWith(prefix)) return null
  try {
    return decodeURIComponent(href.slice(prefix.length))
  } catch {
    return href.slice(prefix.length)
  }
}

/** Collect every wiki page title referenced in a body (for backlinks later). */
export function extractWikiPageTitles(source: string): string[] {
  const titles: string[] = []
  const re = /(?<!!)\[\[([^\]\n]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const title = match[1]?.trim()
    if (title) titles.push(title)
  }
  return titles
}
