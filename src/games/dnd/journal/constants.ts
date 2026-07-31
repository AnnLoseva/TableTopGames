import type { DndJournalCategory, DndPageType } from './types'

export const DND_JOURNAL_PAGES_TABLE = 'dnd_journal_pages'
export const DND_JOURNAL_IMAGES_TABLE = 'dnd_journal_images'
export const DND_JOURNAL_FOLDERS_TABLE = 'dnd_journal_folders'
export const DND_JOURNAL_IMAGES_BUCKET = 'dnd-journal-images'

// The site owner's account (Supabase Auth user id for the "Anna" row in
// public.users) — used here only to decide whether *this UI* shows edit
// controls. Any other signed-in TableTopGames account can read but never
// write. The RLS policies in supabase/dnd_journal.sql are the real security
// boundary and also allow a second identity, a "RenaCompanionDevice" service
// account the iPad app's background sync signs in as (see that repo's
// Support/JournalSyncConfig.swift) — that account has no reason to ever load
// this site, so it's intentionally not part of this UI-only constant.
export const DND_JOURNAL_OWNER_AUTH_USER_ID = '44153f98-aaf2-4935-b7b2-45fe3155edc6'

export const DND_PAGE_TYPES: DndPageType[] = [
  'note', 'session', 'character', 'location', 'organization', 'event',
  'chronology', 'quest', 'plotHook', 'item', 'document', 'image', 'main', 'bestiary',
]

// Labels/order mirror PageType.displayName in JournalPage.swift.
export const DND_PAGE_TYPE_LABELS: Record<DndPageType, string> = {
  note: 'Обычная заметка',
  session: 'Сессия',
  character: 'Персонаж',
  location: 'Локация',
  organization: 'Организация',
  event: 'Событие',
  chronology: 'Элемент хронологии',
  quest: 'Задание',
  plotHook: 'Сюжетная зацепка',
  item: 'Предмет',
  document: 'Документ',
  image: 'Изображение',
  main: 'Главная страница',
  bestiary: 'Бестиарий',
}

// Mirrors PageType.category in JournalPage.swift.
export const DND_PAGE_CATEGORY_BY_TYPE: Record<DndPageType, DndJournalCategory> = {
  main: 'main',
  note: 'main',
  session: 'session',
  character: 'character',
  location: 'location',
  organization: 'organization',
  event: 'chronology',
  chronology: 'chronology',
  quest: 'quest',
  plotHook: 'quest',
  item: 'item',
  document: 'item',
  image: 'images',
  bestiary: 'bestiary',
}

// Order/labels mirror JournalCategory.displayName in JournalNote.swift.
export const DND_JOURNAL_CATEGORY_ORDER: DndJournalCategory[] = [
  'main', 'session', 'character', 'location', 'organization', 'chronology', 'quest', 'item', 'template', 'images', 'bestiary',
]

export const DND_JOURNAL_CATEGORY_LABELS: Record<DndJournalCategory, string> = {
  main: 'Главная',
  session: 'Сессии',
  character: 'Персонажи',
  location: 'Локации',
  organization: 'Организации',
  chronology: 'События и хронология',
  quest: 'Задания и зацепки',
  item: 'Предметы и документы',
  template: 'Шаблоны',
  bestiary: 'Бестиарий',
  images: 'Изображения',
}

export const DND_JOURNAL_CATEGORY_SIGILS: Record<DndJournalCategory, string> = {
  main: 'Г',
  session: 'С',
  character: 'П',
  location: 'Л',
  organization: 'О',
  chronology: 'Х',
  quest: 'Ц',
  item: 'Д',
  template: 'Ш',
  images: 'И',
  bestiary: 'Б',
}

export const DND_JOURNAL_MAX_FOLDER_DEPTH = 3

export const DND_JOURNAL_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const DND_JOURNAL_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
