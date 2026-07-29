import type {
  SessionLogAttachment,
  SessionLogEntry,
  SessionLogEntryRow,
  SessionLogPublished,
  SessionLogPublishedRow,
} from './types'

function asAttachments(value: unknown): SessionLogAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const url = typeof row.url === 'string' ? row.url : ''
    if (!url) return []
    const kind = row.kind === 'image' || row.kind === 'file' || row.kind === 'link' ? row.kind : 'file'
    return [{
      id: typeof row.id === 'string' ? row.id : `att-${index}`,
      kind,
      name: typeof row.name === 'string' ? row.name : 'file',
      url,
    }]
  })
}

export function mapSessionLogEntryRow(row: SessionLogEntryRow): SessionLogEntry {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sessionId: row.session_id,
    title: row.title,
    bodyHtml: row.body_html,
    tags: row.tags || [],
    visibility: row.visibility,
    status: row.status,
    sharedPlayerIds: (row.shared_player_ids || []).map(String),
    attachments: asAttachments(row.attachments),
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toSessionLogEntryRow(entry: SessionLogEntry): SessionLogEntryRow {
  return {
    id: entry.id,
    chronicle_id: entry.chronicleId,
    room: entry.room,
    session_id: entry.sessionId,
    title: entry.title,
    body_html: entry.bodyHtml,
    tags: entry.tags,
    visibility: entry.visibility,
    status: entry.status,
    shared_player_ids: entry.sharedPlayerIds,
    attachments: entry.attachments,
    version: entry.version,
    created_by: entry.createdBy,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

export function mapPublishedRow(row: SessionLogPublishedRow): SessionLogPublished {
  return {
    entryId: row.entry_id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sessionId: row.session_id,
    title: row.title,
    bodyHtml: row.body_html,
    tags: row.tags || [],
    visibility: row.visibility,
    sharedPlayerIds: (row.shared_player_ids || []).map(String),
    publishedAt: row.published_at,
    publishedVersion: row.published_version,
  }
}

/** Build player projection from master draft — never includes private-only drafts. */
export function toPublishedProjection(entry: SessionLogEntry): SessionLogPublished | null {
  if (entry.visibility === 'private' || entry.status === 'draft' || entry.status === 'archived') {
    return null
  }
  return {
    entryId: entry.id,
    chronicleId: entry.chronicleId,
    room: entry.room,
    sessionId: entry.sessionId,
    title: entry.title,
    bodyHtml: entry.bodyHtml,
    tags: entry.tags,
    visibility: entry.visibility === 'shared_selected' ? 'shared_selected' : 'shared_all',
    sharedPlayerIds: entry.sharedPlayerIds,
    publishedAt: new Date().toISOString(),
    publishedVersion: entry.version,
  }
}
