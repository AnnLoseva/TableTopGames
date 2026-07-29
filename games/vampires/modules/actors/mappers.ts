import type {
  ActorPrivateFields,
  ActorPrivateRow,
  ChronicleActor,
  ChronicleActorRow,
  CompactActorStats,
} from './types'

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function mapChronicleActorRow(row: ChronicleActorRow): ChronicleActor {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    kind: row.kind,
    characterId: row.character_id,
    name: row.name,
    faction: row.faction,
    actorRole: row.actor_role,
    status: row.status,
    tags: row.tags || [],
    currentSceneId: row.current_scene_id,
    compactStats: objectValue(row.compact_stats) as CompactActorStats,
    imageUrl: row.image_url,
    manualOverrides: objectValue(row.manual_overrides),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapActorPrivateRow(row: ActorPrivateRow): ActorPrivateFields {
  return {
    secrets: row.secrets,
    motivation: row.motivation,
    plans: row.plans,
    notes: row.notes,
    privateData: objectValue(row.private_data),
  }
}

export function toActorBulkPatch(patch: import('./types').ActorBulkPatch) {
  return {
    ...(patch.faction !== undefined ? { faction: patch.faction } : {}),
    ...(patch.actorRole !== undefined ? { actor_role: patch.actorRole } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.currentSceneId !== undefined ? { current_scene_id: patch.currentSceneId || '' } : {}),
    ...(patch.compactStats !== undefined ? { compact_stats: patch.compactStats } : {}),
    ...(patch.imageUrl !== undefined ? { image_url: patch.imageUrl } : {}),
    ...(patch.manualOverrides !== undefined ? { manual_overrides: patch.manualOverrides } : {}),
  }
}
