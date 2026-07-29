import type { Module } from '@/core/hub'
import type { MasterVisibility } from '@/games/vampires/modules/master-console/persistence/types'

export type LoreModule = Module<'lore', 'vtm5'>

export type LoreEntryStatus = 'draft' | 'published' | 'archived'
export type LoreCategoryKind =
  | 'clans'
  | 'disciplines'
  | 'merits'
  | 'npc'
  | 'locations'
  | 'plots'
  | 'random_tables'
  | 'custom'
  | 'system'

export type LoreAttachment = {
  id: string
  kind: 'image' | 'audio' | 'file' | 'link'
  name: string
  url: string
}

export type LoreCategory = {
  id: string
  chronicleId: string
  room: string
  slug: string
  title: string
  kind: LoreCategoryKind
  sortOrder: number
  /** True for system reference categories (not stored as chronicle rows). */
  isSystem?: boolean
  entryCount?: number
  createdAt?: string
  updatedAt?: string
}

export type LoreEntry = {
  id: string
  chronicleId: string
  room: string
  categoryId: string | null
  categorySlug: string
  title: string
  shortSummary: string
  bodyHtml: string
  tags: string[]
  visibility: MasterVisibility
  status: LoreEntryStatus
  attachments: LoreAttachment[]
  /** Master-only; never present in player-safe payloads. */
  privateNote?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Player-safe / shared projection — privateNote stripped. */
export type LoreEntryPublic = Omit<LoreEntry, 'privateNote'>

export type RandomTableRow = {
  id: string
  text: string
  weight: number
}

export type RandomTable = {
  id: string
  chronicleId: string
  room: string
  title: string
  description: string
  tags: string[]
  visibility: MasterVisibility
  diceExpression: string
  rows: RandomTableRow[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type RandomTableRollResult = {
  tableId: string
  tableTitle: string
  rowId: string
  text: string
  weight: number
  rollIndex: number
  totalWeight: number
  rolledAt: string
}

export type SystemReferenceHit = {
  id: string
  source: 'system'
  categorySlug: string
  title: string
  shortSummary: string
  referenceSlug: string
  tags: string[]
}

export type LoreSearchHit =
  | { kind: 'entry'; entry: LoreEntry }
  | { kind: 'table'; table: RandomTable }
  | { kind: 'system'; hit: SystemReferenceHit }

export type LoreCategoryRow = {
  id: string
  chronicle_id: string
  room: string
  slug: string
  title: string
  kind: LoreCategoryKind
  sort_order: number
  created_at: string
  updated_at: string
}

export type LoreEntryRow = {
  id: string
  chronicle_id: string
  room: string
  category_id: string | null
  category_slug: string
  title: string
  short_summary: string
  body_html: string
  tags: string[] | null
  visibility: MasterVisibility
  status: LoreEntryStatus
  attachments: unknown
  created_by: string
  created_at: string
  updated_at: string
}

export type LoreEntryPrivateRow = {
  entry_id: string
  chronicle_id: string
  room: string
  private_note: string
  updated_at: string
}

export type RandomTableRowDb = {
  id: string
  chronicle_id: string
  room: string
  title: string
  description: string
  tags: string[] | null
  visibility: MasterVisibility
  dice_expression: string
  rows: unknown
  created_by: string
  created_at: string
  updated_at: string
}

export type EntityLinkChip = {
  id: string
  targetType: string
  targetId: string
  label: string
  relationType: string
  moduleId?: string
}
