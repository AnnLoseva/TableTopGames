import type { RandomTable, RandomTableRollResult, RandomTableRow } from '../types'

/**
 * Weighted random pick. weight defaults to 1; zero/negative weights skipped.
 */
export function rollWeightedRow(
  rows: readonly RandomTableRow[],
  rng: () => number = Math.random,
): { row: RandomTableRow; rollIndex: number; totalWeight: number } | null {
  const eligible = rows
    .map((row, index) => ({ row, index, weight: Math.max(0, Math.floor(Number(row.weight) || 0)) }))
    .filter(item => item.weight > 0 && item.row.text.trim())
  if (!eligible.length) return null

  const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.floor(rng() * totalWeight)
  for (const item of eligible) {
    cursor -= item.weight
    if (cursor < 0) {
      return { row: item.row, rollIndex: item.index, totalWeight }
    }
  }
  const last = eligible[eligible.length - 1]
  return { row: last.row, rollIndex: last.index, totalWeight }
}

export function rollRandomTable(
  table: RandomTable,
  rng: () => number = Math.random,
): RandomTableRollResult | null {
  const picked = rollWeightedRow(table.rows, rng)
  if (!picked) return null
  return {
    tableId: table.id,
    tableTitle: table.title,
    rowId: picked.row.id,
    text: picked.row.text,
    weight: picked.row.weight,
    rollIndex: picked.rollIndex,
    totalWeight: picked.totalWeight,
    rolledAt: new Date().toISOString(),
  }
}
