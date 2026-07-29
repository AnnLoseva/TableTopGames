import { PATHFINDER2_SKILLS } from '../../data'
import type {
  Pathfinder2CalculatedSkills,
  Pathfinder2CharacterDraft,
  Pathfinder2SkillId,
} from '../../types'
import type { Pathfinder2SkillChoiceOption } from './types'

export function getSkillChoiceOptions(
  draft: Pathfinder2CharacterDraft,
  calculated: Pathfinder2CalculatedSkills,
  currentSelections: Pathfinder2SkillId[],
  limit: number,
  allowedSkills?: Pathfinder2SkillId[],
): Pathfinder2SkillChoiceOption[] {
  const otherSelections = new Set<Pathfinder2SkillId>([
    ...Object.values(draft.skillChoices.grantedChoiceSelections).flat(),
    ...draft.skillChoices.classFreeSkills,
    ...draft.skillChoices.intelligenceSkills,
    ...Object.values(draft.skillChoices.replacementSkills),
  ].filter(skillId => !currentSelections.includes(skillId)))
  const granted = new Set(calculated.grantedSkills)
  const full = currentSelections.length >= limit

  return PATHFINDER2_SKILLS.map(skill => {
    const selectedHere = currentSelections.includes(skill.id)
    let reason: string | undefined
    if (allowedSkills && !allowedSkills.includes(skill.id)) {
      reason = 'Этот источник не разрешает выбрать данный навык.'
    } else if (!selectedHere && granted.has(skill.id)) {
      reason = 'Навык уже предоставлен автоматически.'
    } else if (!selectedHere && otherSelections.has(skill.id)) {
      reason = 'Навык уже занят другим блоком выбора.'
    } else if (!selectedHere && full) {
      reason = 'Все доступные слоты этого блока уже заполнены.'
    }
    return {
      skillId: skill.id,
      disabled: Boolean(reason),
      ...(reason ? { reason } : {}),
    }
  })
}

export function toggleSkillChoice(
  selections: Pathfinder2SkillId[],
  skillId: Pathfinder2SkillId,
  limit: number,
) {
  if (selections.includes(skillId)) {
    return selections.filter(value => value !== skillId)
  }
  if (selections.length >= limit) return selections
  return [...selections, skillId]
}
