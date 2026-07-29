import { PATHFINDER2_SKILLS } from '../../data'
import {
  getBackgroundById,
  getClassById,
  getSubclassById,
} from '../../data/selectors'
import type {
  Pathfinder2CalculatedSkills,
  Pathfinder2CharacterDraft,
  Pathfinder2GrantedSkillRule,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillChoiceRule,
  Pathfinder2SkillId,
  Pathfinder2SkillSource,
  Pathfinder2Attributes,
} from '../../types'
import { applyValidSkillIncreases } from '../progression/skill-progression'
import { getProficiencyBonus } from './proficiency'

type IdentifiedGrant = Pathfinder2GrantedSkillRule & { id: string }
type IdentifiedChoice = Pathfinder2SkillChoiceRule & { id: string }

export function getSkillRuleBlocks(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
) {
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const specialization = getSubclassById(catalog, draft.classId, draft.subclassId)

  const grants: IdentifiedGrant[] = [
    ...(background?.skillRules.grantedSkills ?? []).map((rule, index) => ({
      ...rule,
      id: `background:${background?.id}:${index}:${rule.skillId}`,
    })),
    ...(characterClass?.skillRules.grantedSkills ?? []).map((rule, index) => ({
      ...rule,
      id: `class:${characterClass?.id}:${index}:${rule.skillId}`,
    })),
    ...(specialization?.grantedSkills ?? []).map((rule, index) => ({
      ...rule,
      id: `specialization:${specialization?.id}:${index}:${rule.skillId}`,
    })),
  ]
  const choiceRules: IdentifiedChoice[] = [
    ...(background?.skillRules.grantedSkillChoices ?? []),
    ...(characterClass?.skillRules.grantedSkillChoices ?? []),
  ]

  return { grants, choiceRules, characterClass }
}

function addSource(
  sources: Map<Pathfinder2SkillId, Pathfinder2SkillSource[]>,
  skillId: Pathfinder2SkillId,
  source: Pathfinder2SkillSource,
) {
  sources.set(skillId, [...(sources.get(skillId) ?? []), source])
}

export function calculateSkills(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
  attributes: Pathfinder2Attributes,
  armorCheckPenalty = 0,
): Pathfinder2CalculatedSkills {
  const { grants, choiceRules, characterClass } = getSkillRuleBlocks(draft, catalog)
  const sources = new Map<Pathfinder2SkillId, Pathfinder2SkillSource[]>()
  const trained = new Set<Pathfinder2SkillId>()
  const grantedSkills = new Set<Pathfinder2SkillId>()
  const replacementChoices: Pathfinder2CalculatedSkills['replacementChoices'] = []

  grants.forEach(grant => {
    if (trained.has(grant.skillId)) {
      replacementChoices.push({
        id: `replacement:${grant.id}`,
        duplicateSkillId: grant.skillId,
        sourceLabel: grant.sourceLabel,
        reason: `${grant.sourceLabel} повторно даёт обучение уже полученному навыку.`,
      })
      return
    }
    trained.add(grant.skillId)
    grantedSkills.add(grant.skillId)
    addSource(sources, grant.skillId, {
      id: grant.id,
      label: grant.sourceLabel,
      kind: 'granted',
    })
  })

  const addSelected = (
    skillId: Pathfinder2SkillId,
    id: string,
    label: string,
    kind: Pathfinder2SkillSource['kind'],
  ) => {
    trained.add(skillId)
    addSource(sources, skillId, { id, label, kind })
  }

  choiceRules.forEach(rule => {
    (draft.skillChoices.grantedChoiceSelections[rule.id] ?? []).forEach(skillId => {
      addSelected(skillId, rule.id, rule.sourceLabel, 'choice')
    })
  })
  replacementChoices.forEach(replacement => {
    const skillId = draft.skillChoices.replacementSkills[replacement.id]
    if (skillId) addSelected(skillId, replacement.id, 'Замена повторного обучения', 'replacement')
  })
  draft.skillChoices.classFreeSkills.forEach(skillId => {
    addSelected(skillId, 'class-free', 'Дополнительный навык класса', 'choice')
  })
  draft.skillChoices.intelligenceSkills.forEach(skillId => {
    addSelected(skillId, 'intelligence', 'Дополнительный навык от Интеллекта', 'choice')
  })

  const initialRanks = Object.fromEntries(
    PATHFINDER2_SKILLS.map(skill => [
      skill.id,
      trained.has(skill.id) ? 'trained' : 'untrained',
    ]),
  ) as Record<Pathfinder2SkillId, Pathfinder2ProficiencyRank>
  const ranks = applyValidSkillIncreases(
    draft.skillChoices.skillIncreases,
    characterClass?.skillRules.skillIncreaseLevels ?? [],
    draft.level,
    initialRanks,
  ) as Record<Pathfinder2SkillId, Pathfinder2ProficiencyRank>

  const skills = Object.fromEntries(PATHFINDER2_SKILLS.map(skill => {
    const rank = ranks[skill.id]
    const attributeModifier = attributes[skill.attribute]
    const proficiencyBonus = getProficiencyBonus(rank, draft.level)
    // Штраф брони к навыкам действует на проверки Силы и Ловкости.
    const checkPenalty = skill.attribute === 'strength' || skill.attribute === 'dexterity'
      ? armorCheckPenalty
      : 0
    return [skill.id, {
      skillId: skill.id,
      attribute: skill.attribute,
      attributeModifier,
      rank,
      proficiencyBonus,
      armorCheckPenalty: checkPenalty,
      modifier: attributeModifier + proficiencyBonus + checkPenalty,
      sources: sources.get(skill.id) ?? [],
    }]
  })) as Pathfinder2CalculatedSkills['skills']

  return {
    skills,
    grantedSkills: [...grantedSkills],
    replacementChoices,
    classFreeLimit: characterClass?.skillRules.baseFreeTrainedSkills ?? 0,
    intelligenceLimit: characterClass?.skillRules.addIntelligenceModifier
      ? Math.max(0, attributes.intelligence)
      : 0,
    trainedCount: Object.values(ranks).filter(rank => rank !== 'untrained').length,
  }
}
