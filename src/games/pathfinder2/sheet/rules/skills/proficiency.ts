import type { Pathfinder2ProficiencyRank } from '../../types'

const PROFICIENCY_RANK_BONUS: Record<Pathfinder2ProficiencyRank, number> = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8,
}

export const PROFICIENCY_RANKS: Pathfinder2ProficiencyRank[] = [
  'untrained',
  'trained',
  'expert',
  'master',
  'legendary',
]

export function getProficiencyBonus(
  rank: Pathfinder2ProficiencyRank,
  level: number,
) {
  if (rank === 'untrained') return 0
  return Math.max(1, Math.round(level)) + PROFICIENCY_RANK_BONUS[rank]
}

export function getNextProficiencyRank(
  rank: Pathfinder2ProficiencyRank,
): Pathfinder2ProficiencyRank | null {
  const index = PROFICIENCY_RANKS.indexOf(rank)
  return PROFICIENCY_RANKS[index + 1] ?? null
}
