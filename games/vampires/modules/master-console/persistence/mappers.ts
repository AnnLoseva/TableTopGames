import { isJsonObject } from './validation'
import type {
  ChronicleEntityLink,
  ChronicleEntityLinkRow,
  ChronicleSession,
  ChronicleSessionRow,
  MasterActionLogEntry,
  MasterActionLogRow,
  MasterLayout,
  MasterLayoutRow,
  MasterMacro,
  MasterMacroRow,
} from './types'

export function mapMasterLayoutRow(row: MasterLayoutRow): MasterLayout {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    ownerId: row.owner_id,
    name: row.name,
    layoutVersion: row.layout_version,
    layoutJson: isJsonObject(row.layout_json) ? row.layout_json : {},
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toMasterLayoutRow(layout: MasterLayout): MasterLayoutRow {
  return {
    id: layout.id,
    chronicle_id: layout.chronicleId,
    room: layout.room,
    owner_id: layout.ownerId,
    name: layout.name,
    layout_version: layout.layoutVersion,
    layout_json: layout.layoutJson,
    is_default: layout.isDefault,
    created_at: layout.createdAt,
    updated_at: layout.updatedAt,
  }
}

export function mapMasterActionLogRow(row: MasterActionLogRow): MasterActionLogEntry {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sessionId: row.session_id,
    actionType: row.action_type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    summary: row.summary,
    payload: isJsonObject(row.payload) ? row.payload : {},
    inversePayload: isJsonObject(row.inverse_payload) ? row.inverse_payload : null,
    visibility: row.visibility,
    createdBy: row.created_by,
    revertedAt: row.reverted_at,
    createdAt: row.created_at,
  }
}

export function mapChronicleSessionRow(row: ChronicleSessionRow): ChronicleSession {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sequenceNumber: row.sequence_number,
    nightNumber: row.night_number,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    publicSummary: row.public_summary,
    privateSummary: row.private_summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMasterMacroRow(row: MasterMacroRow): MasterMacro {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    ownerId: row.owner_id,
    title: row.title,
    actionType: row.action_type,
    shortcut: row.shortcut,
    config: isJsonObject(row.config) ? row.config : {},
    sortOrder: row.sort_order,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toChronicleEntityLinkRow(
  link: Omit<ChronicleEntityLink, 'id' | 'createdAt'>,
): Omit<ChronicleEntityLinkRow, 'id' | 'created_at'> {
  return {
    chronicle_id: link.chronicleId,
    room: link.room,
    source_type: link.sourceType,
    source_id: link.sourceId,
    target_type: link.targetType,
    target_id: link.targetId,
    relation_type: link.relationType,
    label: link.label,
    visibility: link.visibility,
    metadata: link.metadata,
  }
}
