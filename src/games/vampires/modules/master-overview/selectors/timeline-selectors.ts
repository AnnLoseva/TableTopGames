import type { MasterActionLogEntry } from '@/games/vampires/modules/master-console/persistence/types'
import type { RollMessage } from '@/games/vampires/modules/table/types'
import type { TimelineItem } from '../types'

function kindFromAction(actionType: string): TimelineItem['kind'] {
  if (actionType.includes('hunger')) return 'hunger'
  if (actionType.includes('macro') || actionType.includes('downtime') || actionType.includes('complication')) return 'macro'
  if (actionType.includes('stain') || actionType.includes('humanity')) return 'stain'
  if (actionType.includes('scene') || actionType.includes('publish')) return 'scene'
  if (actionType.includes('reveal') || actionType.includes('secret')) return 'secret'
  if (actionType.includes('roll')) return 'roll'
  if (actionType.includes('consequence')) return 'consequence'
  return 'action'
}

export function selectTimelineFromActionLog(
  entries: readonly MasterActionLogEntry[],
): TimelineItem[] {
  return entries.map(entry => ({
    id: `action:${entry.id}`,
    at: entry.createdAt,
    kind: kindFromAction(entry.actionType),
    title: entry.summary,
    detail: entry.actionType,
    consequence: typeof entry.payload.consequence === 'string'
      ? entry.payload.consequence
      : undefined,
    hidden: entry.visibility === 'master',
    sourceType: entry.actorType,
    sourceId: entry.actorId,
  }))
}

export function selectTimelineFromRolls(rolls: readonly RollMessage[]): TimelineItem[] {
  return rolls.map(roll => {
    const bestial = roll.meta?.bestialFailure
    const messy = roll.meta?.messyCritical
    const consequence = bestial
      ? 'последствие: риск френзи / шум'
      : messy
        ? 'последствие: грязный критический эффект'
        : roll.meta?.warnings?.[0]
    return {
      id: `roll:${roll.id}`,
      at: roll.createdAt,
      kind: 'roll' as const,
      title: `${roll.hidden ? 'Скрытый бросок' : 'Бросок'} ${roll.characterName}: ${roll.successes} усп.`,
      detail: roll.poolName,
      consequence,
      hidden: Boolean(roll.hidden),
      sourceType: 'roll',
      sourceId: roll.id,
    }
  })
}

export function mergeTimeline(
  actionItems: readonly TimelineItem[],
  rollItems: readonly TimelineItem[],
  limit = 40,
): TimelineItem[] {
  const seen = new Set<string>()
  return [...actionItems, ...rollItems]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter(item => {
      // Prefer action-log entries when they already describe the same roll id.
      const key = item.sourceId
      if (item.kind === 'roll' && actionItems.some(action => action.detail.includes(item.sourceId) || String(action.title).includes(item.sourceId))) {
        return false
      }
      if (seen.has(item.id)) return false
      seen.add(item.id)
      if (key && seen.has(`src:${key}`) && item.kind === 'roll') return false
      if (key) seen.add(`src:${key}`)
      return true
    })
    .slice(0, limit)
}

export function countOpenConsequences(items: readonly TimelineItem[]): number {
  return items.filter(item => Boolean(item.consequence) && item.kind !== 'manual').length
}
