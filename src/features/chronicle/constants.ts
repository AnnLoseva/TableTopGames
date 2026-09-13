import type { ChapterDoc } from './types'

export const CHRONICLE_CHAPTERS_TABLE = 'chronicle_chapters'
export const CHRONICLE_SNAPSHOTS_TABLE = 'chronicle_snapshots'
/** The reader's only door — published rows, public columns. See `chronicle.sql`. */
export const CHRONICLE_PUBLISHED_VIEW = 'chronicle_published_chapters'
export const CHRONICLE_SETTINGS_TABLE = 'chronicle_settings'

/** Same account that owns the relationship map: the single author. */
export const CHRONICLE_OWNER_AUTH_USER_ID = '44153f98-aaf2-4935-b7b2-45fe3155edc6'

export const CHAPTER_TITLE_MAX_LENGTH = 200
export const CHAPTER_SLUG_MAX_LENGTH = 120
export const TIMELINE_LABEL_MAX_LENGTH = 200

export const EMPTY_CHAPTER_DOC: ChapterDoc = { type: 'doc', content: [] }

const TRANSLITERATION: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/**
 * A chapter's URL is public and permanent-ish, so Russian titles are
 * transliterated rather than percent-encoded into noise. Empty input (an
 * untitled draft) yields '' — the caller decides on a fallback.
 */
export function slugify(input: string): string {
  const lowered = input.trim().toLowerCase()
  let out = ''
  for (const char of lowered) {
    if (TRANSLITERATION[char] !== undefined) out += TRANSLITERATION[char]
    else if (/[a-z0-9]/.test(char)) out += char
    else if (/[\s\-_/.,:;!?'"«»()]/.test(char)) out += '-'
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, CHAPTER_SLUG_MAX_LENGTH)
}

/** Makes `slug` unique against `taken` by appending -2, -3, … */
export function uniqueSlug(slug: string, taken: string[]): string {
  const base = slug || 'chapter'
  if (!taken.includes(base)) return base
  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!taken.includes(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Rough minutes-to-read, shown to the reader. ~180 wpm for prose. */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 180))
}

export const DEFAULT_SETTINGS = {
  title: 'Хроника',
  subtitle: '',
  intro: '',
  showYearToReader: true,
}
