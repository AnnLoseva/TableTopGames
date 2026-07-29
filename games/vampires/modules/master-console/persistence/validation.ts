import type { ChronicleEntityLink, JsonObject } from './types'

const TYPE_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateEntityLink(
  link: Pick<ChronicleEntityLink, 'sourceType' | 'sourceId' | 'targetType' | 'targetId' | 'relationType' | 'visibility' | 'metadata'>,
) {
  if (!TYPE_ID_PATTERN.test(link.sourceType)) return 'Invalid source type'
  if (!TYPE_ID_PATTERN.test(link.targetType)) return 'Invalid target type'
  if (!TYPE_ID_PATTERN.test(link.relationType)) return 'Invalid relation type'
  if (!link.sourceId.trim() || link.sourceId.length > 160 || link.sourceId !== link.sourceId.trim()) return 'Invalid source id'
  if (!link.targetId.trim() || link.targetId.length > 160 || link.targetId !== link.targetId.trim()) return 'Invalid target id'
  if (link.sourceType === link.targetType && link.sourceId === link.targetId) return 'Entity link cannot target itself'
  if (link.visibility !== 'master' && link.visibility !== 'shared') return 'Invalid visibility'
  if (!isJsonObject(link.metadata)) return 'Invalid metadata'
  return null
}
