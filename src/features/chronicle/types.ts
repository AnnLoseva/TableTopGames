/**
 * The chronicle domain: the fanfic itself — chapters the reader sees, written
 * in an author-only editor. Characters, relationships and the relationship
 * timeline are NOT redefined here: they live in `src/features/characters_map`
 * and this domain links to that map by year. See `docs/ai/DECISIONS.md`.
 */

export type ChapterStatus = 'draft' | 'published'

/** A TipTap document. Kept opaque here — `ChapterContent` walks it for display. */
export type ChapterDoc = {
  type: string
  content?: unknown[]
  [key: string]: unknown
}

/**
 * The moment in the story's world a chapter happens at. Mirrors the
 * relationship map's date model exactly (`year` orders, `month`/`day` refine),
 * so "open the map at this chapter's moment" is a straight hand-off.
 * `year` is null only while a chapter is an unfinished draft — publishing
 * requires it, enforced by a CHECK constraint in `chronicle.sql`.
 */
export type ChapterMoment = {
  year: number | null
  month: number | null
  day: number | null
  label: string
  snapshotId: string | null
}

/** The author's view of a chapter — everything, including private fields. */
export type Chapter = {
  id: string
  title: string
  slug: string
  number: number
  content: ChapterDoc
  contentText: string
  status: ChapterStatus
  moment: ChapterMoment
  /** Private. Never leaves the database for a reader — see `chronicle.sql`. */
  authorNotes: string
  coverImage: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

/**
 * The reader's view — exactly the columns the public view exposes. There is no
 * `status`, no `authorNotes` and no draft row to be had: the anon role cannot
 * read the underlying table at all.
 */
export type PublicChapter = {
  id: string
  title: string
  slug: string
  number: number
  content: ChapterDoc
  contentText: string
  year: number | null
  month: number | null
  day: number | null
  timelineLabel: string
  coverImage: string | null
  publishedAt: string | null
}

/** A named point on the timeline ("1848 — Cirque Oriental"). Author-only. */
export type Snapshot = {
  id: string
  year: number
  month: number | null
  day: number | null
  label: string
  description: string
  coverImage: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ChapterRow = {
  id: string
  user_id: string
  title: string
  slug: string
  chapter_number: number
  content: unknown
  content_text: string
  status: string
  timeline_year: number | null
  timeline_month: number | null
  timeline_day: number | null
  timeline_label: string
  timeline_snapshot_id: string | null
  author_notes: string
  cover_image: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export type PublicChapterRow = {
  id: string
  title: string
  slug: string
  chapter_number: number
  content: unknown
  content_text: string
  timeline_year: number | null
  timeline_month: number | null
  timeline_day: number | null
  timeline_label: string
  cover_image: string | null
  published_at: string | null
}

export type SnapshotRow = {
  id: string
  user_id: string
  year: number
  month: number | null
  day: number | null
  label: string
  description: string
  cover_image: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ChapterPatch = Partial<{
  title: string
  slug: string
  number: number
  content: ChapterDoc
  contentText: string
  status: ChapterStatus
  moment: ChapterMoment
  authorNotes: string
  coverImage: string | null
}>

export type SnapshotPatch = Partial<Omit<Snapshot, 'id' | 'createdAt' | 'updatedAt'>>

/** Public site copy + the single reader-facing toggle. One row, id = 1. */
export type ChronicleSettings = {
  title: string
  subtitle: string
  intro: string
  showYearToReader: boolean
}

export type ChronicleSettingsRow = {
  id: number
  title: string
  subtitle: string
  intro: string
  show_year_to_reader: boolean
  updated_at: string
}
