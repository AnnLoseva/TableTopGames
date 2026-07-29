export type {
  Pathfinder2CalculatedSkill,
  Pathfinder2CalculatedSkills,
  Pathfinder2ClassSkillRules,
  Pathfinder2ProficiencyRank,
  Pathfinder2ReplacementChoice,
  Pathfinder2SkillChoiceRule,
  Pathfinder2SkillChoices,
  Pathfinder2SkillId,
  Pathfinder2SkillIncrease,
} from '../../types'

export type Pathfinder2SkillChoiceOption = {
  skillId: import('../../types').Pathfinder2SkillId
  disabled: boolean
  reason?: string
}
