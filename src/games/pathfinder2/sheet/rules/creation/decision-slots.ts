import type {
  Pathfinder2CharacterSource,
  Pathfinder2DecisionSlot,
  Pathfinder2FeatSlot,
  Pathfinder2FeatSlotType,
} from '../../types'

function normalizeSlotPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function createDecisionSlotId({
  source,
  type,
  level,
  index = 0,
}: {
  source: Pathfinder2CharacterSource
  type: string
  level: number
  index?: number
}) {
  const sourceId = normalizeSlotPart(source.id) || 'unknown-source'
  const slotType = normalizeSlotPart(type) || 'choice'
  return `${source.type}:${sourceId}:${slotType}:${level}:${index}`
}

export function createDecisionSlot<Type extends string>({
  source,
  type,
  level,
  required = true,
  count = 1,
  selectedIds = [],
  index = 0,
}: {
  source: Pathfinder2CharacterSource
  type: Type
  level: number
  required?: boolean
  count?: number
  selectedIds?: string[]
  index?: number
}): Pathfinder2DecisionSlot<Type> {
  return {
    id: createDecisionSlotId({ source, type, level, index }),
    level,
    type,
    source,
    required,
    count: Math.max(1, Math.round(count)),
    selectedIds: Array.from(new Set(selectedIds)).slice(0, Math.max(1, count)),
  }
}

export function createFeatSlot({
  source,
  type,
  level,
  required = true,
  selectedFeatId = null,
  index = 0,
}: {
  source: Pathfinder2CharacterSource
  type: Pathfinder2FeatSlotType
  level: number
  required?: boolean
  selectedFeatId?: string | null
  index?: number
}): Pathfinder2FeatSlot {
  return {
    id: createDecisionSlotId({ source, type, level, index }),
    level,
    type,
    source,
    required,
    selectedFeatId,
  }
}

export function isDecisionSlotComplete(
  slot: Pathfinder2DecisionSlot | Pathfinder2FeatSlot,
) {
  if (!slot.required) return true
  if ('selectedFeatId' in slot) return Boolean(slot.selectedFeatId)
  return slot.selectedIds.length === slot.count
}
