import { DND_PAGE_TYPES } from './constants'
import type {
  DndJournalImage,
  DndJournalImageRow,
  DndJournalPage,
  DndJournalPageRow,
  DndPageType,
} from './types'

function asPageType(value: string): DndPageType {
  return (DND_PAGE_TYPES as string[]).includes(value) ? (value as DndPageType) : 'note'
}

export function mapPageRow(row: DndJournalPageRow): DndJournalPage {
  return {
    id: row.id,
    title: row.title,
    bodyMarkdown: row.body_markdown,
    type: asPageType(row.type),
    aliases: row.aliases ?? [],
    isFavorite: row.is_favorite,
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapImageRow(row: DndJournalImageRow): DndJournalImage {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }
}
