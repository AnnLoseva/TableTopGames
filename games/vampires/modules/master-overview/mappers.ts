import type {
  PlotHook,
  PlotHookRow,
  SessionNote,
  SessionNoteRow,
} from './types'

export function mapSessionNoteRow(row: SessionNoteRow): SessionNote {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sessionId: row.session_id,
    title: row.title,
    bodyHtml: row.body_html,
    entityType: row.entity_type,
    entityId: row.entity_id,
    visibility: row.visibility,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toSessionNoteRow(note: SessionNote): SessionNoteRow {
  return {
    id: note.id,
    chronicle_id: note.chronicleId,
    room: note.room,
    session_id: note.sessionId,
    title: note.title,
    body_html: note.bodyHtml,
    entity_type: note.entityType,
    entity_id: note.entityId,
    visibility: note.visibility,
    created_by: note.createdBy,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  }
}

export function mapPlotHookRow(row: PlotHookRow): PlotHook {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    title: row.title,
    nextStep: row.next_step,
    heat: row.heat,
    status: row.status,
    relatedActorIds: row.related_actor_ids || [],
    relatedLocationIds: row.related_location_ids || [],
    relatedSessionIds: row.related_session_ids || [],
    loreEntryId: row.lore_entry_id || '',
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toPlotHookRow(plot: PlotHook): PlotHookRow {
  return {
    id: plot.id,
    chronicle_id: plot.chronicleId,
    room: plot.room,
    title: plot.title,
    next_step: plot.nextStep,
    heat: plot.heat,
    status: plot.status,
    related_actor_ids: plot.relatedActorIds,
    related_location_ids: plot.relatedLocationIds,
    related_session_ids: plot.relatedSessionIds,
    lore_entry_id: plot.loreEntryId,
    sort_order: plot.sortOrder,
    created_by: plot.createdBy,
    created_at: plot.createdAt,
    updated_at: plot.updatedAt,
  }
}
