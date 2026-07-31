// Mirrors "DnD Interactive Sheet/Models/GameState/JournalPage.swift" (PageType)
// and "JournalImage.swift". Keep in sync with supabase/dnd_journal.sql.

export type DndPageType =
  | 'note'
  | 'session'
  | 'character'
  | 'location'
  | 'organization'
  | 'event'
  | 'chronology'
  | 'quest'
  | 'plotHook'
  | 'item'
  | 'document'
  | 'image'
  | 'main'
  | 'bestiary'

export type DndJournalCategory =
  | 'main'
  | 'session'
  | 'character'
  | 'location'
  | 'organization'
  | 'chronology'
  | 'quest'
  | 'item'
  | 'template'
  | 'images'
  | 'bestiary'

export type DndJournalPage = {
  id: string
  title: string
  bodyMarkdown: string
  type: DndPageType
  aliases: string[]
  isFavorite: boolean
  isPinned: boolean
  isArchived: boolean
  folderId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type DndJournalPageEditablePatch = Partial<Pick<
  DndJournalPage,
  'title' | 'bodyMarkdown' | 'type' | 'aliases' | 'isFavorite' | 'isPinned' | 'isArchived' | 'folderId' | 'sortOrder'
>>

export type DndJournalFolder = {
  id: string
  sectionId: DndJournalCategory
  parentFolderId: string | null
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type DndJournalScope =
  | { kind: 'category'; category: DndJournalCategory }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'archived' }

export type DndJournalImage = {
  id: string
  pageId: string | null
  name: string
  storagePath: string
  createdAt: string
}

/** Row shapes from `dnd_journal_pages` / `dnd_journal_images` (snake_case, includes soft-delete). */
export type DndJournalPageRow = {
  id: string
  user_id: string
  title: string
  body_markdown: string
  type: string
  aliases: string[] | null
  is_favorite: boolean
  is_pinned: boolean
  is_archived: boolean
  folder_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DndJournalFolderRow = {
  id: string
  user_id: string
  section_id: string
  parent_folder_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DndJournalImageRow = {
  id: string
  user_id: string
  page_id: string | null
  name: string
  storage_path: string
  created_at: string
  deleted_at: string | null
}
