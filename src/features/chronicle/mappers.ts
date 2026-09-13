import { EMPTY_CHAPTER_DOC } from './constants'
import type {
  Chapter,
  ChapterDoc,
  ChapterRow,
  ChapterStatus,
  PublicChapter,
  PublicChapterRow,
  Snapshot,
  SnapshotRow,
} from './types'

function asDoc(value: unknown): ChapterDoc {
  if (value && typeof value === 'object' && (value as ChapterDoc).type === 'doc') return value as ChapterDoc
  return EMPTY_CHAPTER_DOC
}

function asStatus(value: string): ChapterStatus {
  return value === 'published' ? 'published' : 'draft'
}

export function mapChapterRow(row: ChapterRow): Chapter {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    number: row.chapter_number,
    content: asDoc(row.content),
    contentText: row.content_text,
    status: asStatus(row.status),
    moment: {
      year: row.timeline_year,
      month: row.timeline_month,
      day: row.timeline_day,
      label: row.timeline_label,
      snapshotId: row.timeline_snapshot_id,
    },
    authorNotes: row.author_notes,
    coverImage: row.cover_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

export function mapPublicChapterRow(row: PublicChapterRow): PublicChapter {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    number: row.chapter_number,
    content: asDoc(row.content),
    contentText: row.content_text,
    year: row.timeline_year,
    month: row.timeline_month,
    day: row.timeline_day,
    timelineLabel: row.timeline_label,
    coverImage: row.cover_image,
    publishedAt: row.published_at,
  }
}

export function mapSnapshotRow(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    day: row.day,
    label: row.label,
    description: row.description,
    coverImage: row.cover_image,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
