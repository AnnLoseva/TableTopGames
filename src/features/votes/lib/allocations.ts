import { TOTAL_PERCENT } from '../constants'

export function createEvenAllocations(orderedIds: readonly string[]): Record<string, number> {
  const count = orderedIds.length
  if (count === 0) return {}

  const share = TOTAL_PERCENT / count
  const result: Record<string, number> = {}
  for (const id of orderedIds) result[id] = share
  return result
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Moving one slider shrinks (or grows) every other option together,
 * proportionally to their current share — the "70% here means less spread
 * across everything else" allocation model. Values are kept fractional here
 * so all of the other sliders move smoothly on every step, with no rounding
 * artifact making it look like only one of them reacted; round only for
 * display and before submitting (`roundAllocationsToIntegers`).
 */
export function redistributeAllocations(
  current: Record<string, number>,
  orderedIds: readonly string[],
  changedId: string,
  rawValue: number,
): Record<string, number> {
  const count = orderedIds.length
  if (count === 0) return current
  if (count === 1) return { [orderedIds[0]]: TOTAL_PERCENT }

  const newValue = clamp(rawValue, 0, TOTAL_PERCENT)
  const remaining = TOTAL_PERCENT - newValue
  const otherIds = orderedIds.filter(id => id !== changedId)
  const othersTotal = otherIds.reduce((sum, id) => sum + (current[id] ?? 0), 0)

  const next: Record<string, number> = { ...current, [changedId]: newValue }

  if (othersTotal <= 0) {
    const share = remaining / otherIds.length
    for (const id of otherIds) next[id] = share
    return next
  }

  for (const id of otherIds) {
    next[id] = ((current[id] ?? 0) / othersTotal) * remaining
  }

  return next
}

export function sumAllocations(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0)
}

/**
 * Largest-remainder rounding: turns fractional allocations into whole
 * percentages that always sum to exactly 100, for display and before
 * submitting a response (the database requires an exact integer total).
 */
export function roundAllocationsToIntegers(
  values: Record<string, number>,
  orderedIds: readonly string[],
): Record<string, number> {
  const entries = orderedIds.map(id => {
    const value = values[id] ?? 0
    const floor = Math.floor(value)
    return { id, floor, remainder: value - floor }
  })

  const result: Record<string, number> = {}
  let assigned = 0
  for (const entry of entries) {
    result[entry.id] = entry.floor
    assigned += entry.floor
  }

  let remaining = TOTAL_PERCENT - assigned
  const byRemainder = [...entries].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < byRemainder.length && remaining > 0; i += 1) {
    result[byRemainder[i].id] += 1
    remaining -= 1
  }

  return result
}
