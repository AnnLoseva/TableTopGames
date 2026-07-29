import type {
  LoreAttachment,
  LoreCategory,
  LoreCategoryRow,
  LoreEntry,
  LoreEntryPrivateRow,
  LoreEntryRow,
  RandomTable,
  RandomTableRow,
  RandomTableRowDb,
} from './types'

function asAttachments(value: unknown): LoreAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const url = typeof row.url === 'string' ? row.url : ''
    if (!url) return []
    const kind = row.kind === 'image' || row.kind === 'audio' || row.kind === 'file' || row.kind === 'link'
      ? row.kind
      : 'file'
    return [{
      id: typeof row.id === 'string' ? row.id : `att-${index}`,
      kind,
      name: typeof row.name === 'string' ? row.name : 'attachment',
      url,
    }]
  })
}

function asTableRows(value: unknown): RandomTableRow[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const text = typeof row.text === 'string' ? row.text : ''
    if (!text.trim()) return []
    return [{
      id: typeof row.id === 'string' ? row.id : `row-${index}`,
      text,
      weight: Math.max(1, Math.floor(Number(row.weight) || 1)),
    }]
  })
}

export function mapLoreCategoryRow(row: LoreCategoryRow): LoreCategory {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toLoreCategoryRow(category: LoreCategory): LoreCategoryRow {
  return {
    id: category.id,
    chronicle_id: category.chronicleId,
    room: category.room,
    slug: category.slug,
    title: category.title,
    kind: category.kind,
    sort_order: category.sortOrder,
    created_at: category.createdAt || new Date().toISOString(),
    updated_at: category.updatedAt || new Date().toISOString(),
  }
}

export function mapLoreEntryRow(
  row: LoreEntryRow,
  privateRow?: LoreEntryPrivateRow | null,
): LoreEntry {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    title: row.title,
    shortSummary: row.short_summary,
    bodyHtml: row.body_html,
    tags: row.tags || [],
    visibility: row.visibility,
    status: row.status,
    attachments: asAttachments(row.attachments),
    privateNote: privateRow?.private_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toLoreEntryRow(entry: LoreEntry): Omit<LoreEntryRow, 'created_by'> & { created_by?: string } {
  return {
    id: entry.id,
    chronicle_id: entry.chronicleId,
    room: entry.room,
    category_id: entry.categoryId,
    category_slug: entry.categorySlug,
    title: entry.title,
    short_summary: entry.shortSummary,
    body_html: entry.bodyHtml,
    tags: entry.tags,
    visibility: entry.visibility,
    status: entry.status,
    attachments: entry.attachments,
    created_by: entry.createdBy,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

/** Strip GM-only fields for any shared/player-facing payload. */
export function toLoreEntryPublic(entry: LoreEntry) {
  const { privateNote: _privateNote, ...publicEntry } = entry
  return publicEntry
}

export function mapRandomTableRow(row: RandomTableRowDb): RandomTable {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    visibility: row.visibility,
    diceExpression: row.dice_expression,
    rows: asTableRows(row.rows),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toRandomTableRow(table: RandomTable): RandomTableRowDb {
  return {
    id: table.id,
    chronicle_id: table.chronicleId,
    room: table.room,
    title: table.title,
    description: table.description,
    tags: table.tags,
    visibility: table.visibility,
    dice_expression: table.diceExpression,
    rows: table.rows,
    created_by: table.createdBy,
    created_at: table.createdAt,
    updated_at: table.updatedAt,
  }
}
