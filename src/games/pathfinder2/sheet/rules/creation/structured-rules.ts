import { PATHFINDER2_SKILLS } from '../../data'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2BackgroundSkillRules,
  Pathfinder2ClassSkillRules,
  Pathfinder2GrantedSkillRule,
  Pathfinder2SkillId,
} from '../../types'

const STANDARD_SKILL_INCREASE_LEVELS = [3, 5, 7, 9, 11, 13, 15, 17, 19]
const ACCELERATED_SKILL_INCREASE_LEVELS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20,
]

const ALL_SKILL_IDS = PATHFINDER2_SKILLS.map(skill => skill.id)

const SKILL_ID_BY_RUSSIAN_NAME = new Map<string, Pathfinder2SkillId>(
  PATHFINDER2_SKILLS.map(skill => [skill.label, skill.id]),
)

const ATTRIBUTE_ID_BY_RUSSIAN_NAME: Record<string, Pathfinder2AttributeKey> = {
  Сила: 'strength',
  Ловкость: 'dexterity',
  Телосложение: 'constitution',
  Интеллект: 'intelligence',
  Мудрость: 'wisdom',
  Харизма: 'charisma',
}

function granted(
  skillId: Pathfinder2SkillId,
  sourceLabel = 'Класс',
): Pathfinder2GrantedSkillRule {
  return { skillId, sourceLabel }
}

function classRule(
  baseFreeTrainedSkills: number,
  grantedSkills: Pathfinder2SkillId[] = [],
  grantedSkillChoices: Pathfinder2ClassSkillRules['grantedSkillChoices'] = [],
  skillIncreaseLevels = STANDARD_SKILL_INCREASE_LEVELS,
): Pathfinder2ClassSkillRules {
  return {
    grantedSkills: grantedSkills.map(skillId => granted(skillId)),
    grantedSkillChoices,
    baseFreeTrainedSkills,
    addIntelligenceModifier: true,
    skillIncreaseLevels: [...skillIncreaseLevels],
  }
}

const CHOICE = {
  deitySkill: {
    id: 'class:deity-skill',
    label: 'Навык божества',
    count: 1,
    allowedSkills: ALL_SKILL_IDS,
    sourceLabel: 'Класс · божество',
  },
  fighterSkill: {
    id: 'class:fighter:starting-skill',
    label: 'Акробатика или Атлетика',
    count: 1,
    allowedSkills: ['acrobatics', 'athletics'] satisfies Pathfinder2SkillId[],
    sourceLabel: 'Класс · Воин',
  },
  guardianSkill: {
    id: 'class:guardian:starting-skill',
    label: 'Атлетика или Общество',
    count: 1,
    allowedSkills: ['athletics', 'society'] satisfies Pathfinder2SkillId[],
    sourceLabel: 'Класс · Хранитель',
  },
  monkSkill: {
    id: 'class:monk:starting-skill',
    label: 'Акробатика или Атлетика',
    count: 1,
    allowedSkills: ['acrobatics', 'athletics'] satisfies Pathfinder2SkillId[],
    sourceLabel: 'Класс · Монах',
  },
  rogueSkill: {
    id: 'class:rogue:starting-skill',
    label: 'Скрытность или Воровство',
    count: 1,
    allowedSkills: ['stealth', 'thievery'] satisfies Pathfinder2SkillId[],
    sourceLabel: 'Класс · Плут',
  },
} satisfies Record<string, Pathfinder2ClassSkillRules['grantedSkillChoices'][number]>

const CLASS_SKILL_RULES: Record<string, Pathfinder2ClassSkillRules> = {
  alchemist: classRule(3, ['crafting']),
  barbarian: classRule(3, ['athletics']),
  bard: classRule(4, ['occultism', 'performance']),
  champion: classRule(2, ['religion'], [CHOICE.deitySkill]),
  cleric: classRule(2, ['religion'], [CHOICE.deitySkill]),
  druid: classRule(2, ['nature']),
  fighter: classRule(3, [], [CHOICE.fighterSkill]),
  guardian: classRule(3, [], [CHOICE.guardianSkill]),
  investigator: classRule(4, ['society'], [], ACCELERATED_SKILL_INCREASE_LEVELS),
  kineticist: classRule(3, ['nature']),
  magus: classRule(2, ['arcana']),
  monk: classRule(3, [], [CHOICE.monkSkill]),
  oracle: classRule(2, ['religion']),
  psychic: classRule(3, ['occultism']),
  ranger: classRule(4, ['nature', 'survival']),
  rogue: classRule(7, [], [CHOICE.rogueSkill], ACCELERATED_SKILL_INCREASE_LEVELS),
  sorcerer: classRule(3),
  summoner: classRule(3),
  swashbuckler: classRule(3, ['acrobatics']),
  thaumaturge: classRule(3),
  witch: classRule(3),
  wizard: classRule(3, ['arcana']),
  gunslinger: classRule(3),
  inventor: classRule(3, ['crafting']),
  exemplar: classRule(3),
  animist: classRule(3, ['nature', 'religion']),
  commander: classRule(3, ['diplomacy', 'intimidation']),
}

const SPECIALIZATION_GRANTED_SKILLS: Record<string, Pathfinder2SkillId[]> = {
  'druid:animal': ['athletics'],
  'druid:leaf': ['diplomacy'],
  'druid:storm': ['acrobatics'],
  'druid:wild': ['survival'],
  'investigator:forensic': ['medicine'],
  'investigator:alchemical': ['crafting'],
  'investigator:investigator': ['stealth'],
  'swashbuckler:battledancer': ['performance'],
  'swashbuckler:braggart': ['intimidation'],
  'swashbuckler:fencer': ['deception'],
  'swashbuckler:wit': ['diplomacy'],
}

export function getStructuredClassSkillRules(classId: string): Pathfinder2ClassSkillRules {
  const rules = CLASS_SKILL_RULES[classId] ?? classRule(0, [], [], [])
  return {
    ...rules,
    grantedSkills: rules.grantedSkills.map(rule => ({ ...rule })),
    grantedSkillChoices: rules.grantedSkillChoices.map(rule => ({
      ...rule,
      ...(rule.allowedSkills ? { allowedSkills: [...rule.allowedSkills] } : {}),
      ...(rule.excludedSkills ? { excludedSkills: [...rule.excludedSkills] } : {}),
    })),
    skillIncreaseLevels: [...rules.skillIncreaseLevels],
  }
}

export function getSpecializationGrantedSkills(
  classId: string,
  specializationId: string,
): Pathfinder2GrantedSkillRule[] {
  return (SPECIALIZATION_GRANTED_SKILLS[`${classId}:${specializationId}`] ?? [])
    .map(skillId => granted(skillId, 'Путь класса'))
}

export function getStructuredBackgroundAbilityOptions(
  value: string,
): Pathfinder2AttributeKey[] {
  return value
    .split(/\s+или\s+/iu)
    .map(part => ATTRIBUTE_ID_BY_RUSSIAN_NAME[part.trim()])
    .filter((key): key is Pathfinder2AttributeKey => Boolean(key))
}

export function getStructuredBackgroundSkillRules(
  backgroundId: string,
  trainedSkills: string,
): Pathfinder2BackgroundSkillRules {
  if (backgroundId === 'scholar') {
    return {
      grantedSkills: [],
      grantedSkillChoices: [{
        id: 'background:scholar:skill',
        label: 'Академический навык',
        count: 1,
        allowedSkills: ['arcana', 'nature', 'occultism', 'religion'],
        sourceLabel: 'Предыстория · Учёный',
      }],
    }
  }

  const directName = trainedSkills.split(/\s+\(/u)[0]?.trim()
  const skillId = SKILL_ID_BY_RUSSIAN_NAME.get(directName)
  return {
    grantedSkills: skillId ? [granted(skillId, 'Предыстория')] : [],
    grantedSkillChoices: [],
  }
}
