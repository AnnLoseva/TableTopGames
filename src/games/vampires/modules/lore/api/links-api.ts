import { createClient } from '@/games/vampires/lib/supabase'
import {
  insertEntityLink,
} from '@/games/vampires/modules/master-console/api'
import { CHRONICLE_ENTITY_LINKS } from '@/games/vampires/modules/master-console/persistence/constants'
import { isJsonObject } from '@/games/vampires/modules/master-console/persistence/validation'
import type { ChronicleEntityLink, ChronicleEntityLinkRow, MasterVisibility } from '@/games/vampires/modules/master-console/persistence/types'
import type { EntityLinkChip } from '../types'

function mapLinkRow(row: ChronicleEntityLinkRow): ChronicleEntityLink {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    relationType: row.relation_type,
    label: row.label,
    visibility: row.visibility,
    metadata: isJsonObject(row.metadata) ? row.metadata : {},
    createdAt: row.created_at,
  }
}

export async function fetchEntityLinksFor(
  room: string,
  sourceType: string,
  sourceId: string,
): Promise<ChronicleEntityLink[]> {
  try {
    const { data, error } = await createClient()
      .from(CHRONICLE_ENTITY_LINKS)
      .select('id, chronicle_id, room, source_type, source_id, target_type, target_id, relation_type, label, visibility, metadata, created_at')
      .eq('room', room)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
    if (error) throw error
    return (data || []).map(row => mapLinkRow(row as ChronicleEntityLinkRow))
  } catch {
    return []
  }
}

export async function fetchEntityLinksInvolving(
  room: string,
  entityType: string,
  entityId: string,
): Promise<ChronicleEntityLink[]> {
  try {
    const client = createClient()
    const [asSource, asTarget] = await Promise.all([
      client.from(CHRONICLE_ENTITY_LINKS)
        .select('id, chronicle_id, room, source_type, source_id, target_type, target_id, relation_type, label, visibility, metadata, created_at')
        .eq('room', room)
        .eq('source_type', entityType)
        .eq('source_id', entityId),
      client.from(CHRONICLE_ENTITY_LINKS)
        .select('id, chronicle_id, room, source_type, source_id, target_type, target_id, relation_type, label, visibility, metadata, created_at')
        .eq('room', room)
        .eq('target_type', entityType)
        .eq('target_id', entityId),
    ])
    if (asSource.error) throw asSource.error
    if (asTarget.error) throw asTarget.error
    const all = [...(asSource.data || []), ...(asTarget.data || [])]
    const seen = new Set<string>()
    return all.flatMap(row => {
      const mapped = mapLinkRow(row as ChronicleEntityLinkRow)
      if (seen.has(mapped.id)) return []
      seen.add(mapped.id)
      return [mapped]
    })
  } catch {
    return []
  }
}

export function linksToChips(
  links: readonly ChronicleEntityLink[],
  selfType: string,
  selfId: string,
): EntityLinkChip[] {
  return links.map(link => {
    const outbound = link.sourceType === selfType && link.sourceId === selfId
    return {
      id: link.id,
      targetType: outbound ? link.targetType : link.sourceType,
      targetId: outbound ? link.targetId : link.sourceId,
      label: link.label || `${outbound ? link.targetType : link.sourceType}`,
      relationType: link.relationType,
    }
  })
}

export async function createEntityLink(input: {
  chronicleId: string
  room: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  relationType: string
  label: string
  visibility?: MasterVisibility
}): Promise<void> {
  await insertEntityLink({
    chronicleId: input.chronicleId,
    room: input.room,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    relationType: input.relationType,
    label: input.label,
    visibility: input.visibility || 'master',
    metadata: {},
  })
}

export async function deleteEntityLink(linkId: string): Promise<void> {
  const { error } = await createClient().from(CHRONICLE_ENTITY_LINKS).delete().eq('id', linkId)
  if (error) throw error
}
