import type {
  Pathfinder2CharacterDraft,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillIncrease,
  Pathfinder2ValidationIssue,
} from '../../types'
import { getNextProficiencyRank } from '../skills/proficiency'
import { getClassSkillIncreaseLevels } from './class-progression'

export function canReachSkillRankAtLevel(
  rank: Pathfinder2ProficiencyRank,
  level: number,
) {
  if (rank === 'master') return level >= 7
  if (rank === 'legendary') return level >= 15
  return true
}

export function validateSkillIncreases(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
  initialRanks: Record<string, Pathfinder2ProficiencyRank>,
): Pathfinder2ValidationIssue[] {
  const issues: Pathfinder2ValidationIssue[] = []
  const ranks = { ...initialRanks }
  const increases = [...draft.skillChoices.skillIncreases]
    .sort((left, right) => left.level - right.level)
  const availableLevels = getClassSkillIncreaseLevels(catalog, draft.classId)

  if (increases.length > availableLevels.filter(level => level <= draft.level).length) {
    issues.push({
      id: 'skills.increases.too-many',
      severity: 'error',
      step: 'features',
      field: 'skillIncreases',
      message: 'Выбрано больше повышений навыков, чем даёт прогрессия класса.',
    })
  }

  increases.forEach((increase, index) => {
    const currentRank = ranks[increase.skillId] ?? 'untrained'
    const expectedNext = getNextProficiencyRank(currentRank)
    if (!availableLevels.includes(increase.level) || increase.level > draft.level) {
      issues.push({
        id: `skills.increase.level.${index}`,
        severity: 'error',
        step: 'features',
        field: `skillIncreases.${index}`,
        message: `Класс не даёт повышение навыка на ${increase.level}-м уровне.`,
      })
      return
    }
    if (
      increase.fromRank !== currentRank
      || increase.toRank !== expectedNext
    ) {
      issues.push({
        id: `skills.increase.sequence.${index}`,
        severity: 'error',
        step: 'features',
        field: `skillIncreases.${index}`,
        message: 'Ранг навыка можно повысить только на одну ступень от текущего ранга.',
      })
      return
    }
    if (!canReachSkillRankAtLevel(increase.toRank, increase.level)) {
      issues.push({
        id: `skills.increase.minimum-level.${index}`,
        severity: 'error',
        step: 'features',
        field: `skillIncreases.${index}`,
        message: increase.toRank === 'master'
          ? 'Ранг мастера недоступен раньше 7-го уровня.'
          : 'Легендарный ранг недоступен раньше 15-го уровня.',
      })
      return
    }
    ranks[increase.skillId] = increase.toRank
  })

  return issues
}

export function applyValidSkillIncreases(
  increases: Pathfinder2SkillIncrease[],
  allowedLevels: number[],
  characterLevel: number,
  ranks: Record<string, Pathfinder2ProficiencyRank>,
) {
  const nextRanks = { ...ranks }
  increases
    .slice()
    .sort((left, right) => left.level - right.level)
    .forEach(increase => {
      const currentRank = nextRanks[increase.skillId] ?? 'untrained'
      if (
        increase.level <= characterLevel
        && allowedLevels.includes(increase.level)
        && increase.fromRank === currentRank
        && increase.toRank === getNextProficiencyRank(currentRank)
        && canReachSkillRankAtLevel(increase.toRank, increase.level)
      ) {
        nextRanks[increase.skillId] = increase.toRank
      }
    })
  return nextRanks
}
