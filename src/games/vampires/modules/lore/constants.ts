export const CHRONICLE_LORE_CATEGORIES = 'chronicle_lore_categories'
export const CHRONICLE_LORE_ENTRIES = 'chronicle_lore_entries'
export const CHRONICLE_LORE_ENTRY_PRIVATE = 'chronicle_lore_entry_private'
export const CHRONICLE_RANDOM_TABLES = 'chronicle_random_tables'

export const LORE_LOCAL_KEY = (room: string) => `vtm-chronicle-lore:${room}`
export const TABLES_LOCAL_KEY = (room: string) => `vtm-chronicle-random-tables:${room}`
export const CATEGORIES_LOCAL_KEY = (room: string) => `vtm-chronicle-lore-categories:${room}`

export type StandardCategorySlug =
  | 'clans'
  | 'disciplines'
  | 'merits'
  | 'npc'
  | 'locations'
  | 'plots'
  | 'random_tables'

/** Standard categories — data, not JSX branches. */
export const STANDARD_LORE_CATEGORIES: readonly {
  slug: StandardCategorySlug
  title: string
  kind: StandardCategorySlug
  systemReferenceSlug?: string
}[] = [
  { slug: 'clans', title: 'Кланы и линии крови', kind: 'clans', systemReferenceSlug: 'clans' },
  { slug: 'disciplines', title: 'Дисциплины и силы', kind: 'disciplines', systemReferenceSlug: 'disciplines' },
  { slug: 'merits', title: 'Достоинства и изъяны', kind: 'merits', systemReferenceSlug: 'character-creation' },
  { slug: 'npc', title: 'НПС (связанные)', kind: 'npc' },
  { slug: 'locations', title: 'Локации и домены', kind: 'locations' },
  { slug: 'plots', title: 'Сюжеты и крюки', kind: 'plots' },
  { slug: 'random_tables', title: 'Случайные таблицы', kind: 'random_tables' },
] as const
