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

const BACKGROUND_SKILL_NAMES: Array<{
  id: Pathfinder2SkillId
  names: string[]
}> = PATHFINDER2_SKILLS.map(skill => ({
  id: skill.id,
  names: [skill.label.toLocaleLowerCase('ru')],
})).map(skill => {
  if (skill.id === 'arcana') return { ...skill, names: [...skill.names, 'мистицизм'] }
  if (skill.id === 'performance') return { ...skill, names: [...skill.names, 'исполнение'] }
  return skill
})

const ATTRIBUTE_ID_BY_RUSSIAN_NAME: Record<string, Pathfinder2AttributeKey> = {
  Сила: 'strength',
  Силы: 'strength',
  Ловкость: 'dexterity',
  Ловкости: 'dexterity',
  Dexteriry: 'dexterity',
  Телосложение: 'constitution',
  Телосложения: 'constitution',
  Выносливость: 'constitution',
  Выносливости: 'constitution',
  Интеллект: 'intelligence',
  Интеллекта: 'intelligence',
  Мудрость: 'wisdom',
  Мудрости: 'wisdom',
  Харизма: 'charisma',
  Харизмы: 'charisma',
}

const ALL_ATTRIBUTE_IDS = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] satisfies Pathfinder2AttributeKey[]

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
  thaumaturgeSkill: {
    id: 'class:thaumaturge:esoteric-skill',
    label: 'Аркана, Природа, Оккультизм или Религия',
    count: 1,
    allowedSkills: ['arcana', 'nature', 'occultism', 'religion'] satisfies Pathfinder2SkillId[],
    sourceLabel: 'Класс · Тауматург',
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
  investigator: classRule(4, ['society'], [], ACCELERATED_SKILL_INCREASE_LEVELS),
  kineticist: classRule(3, ['nature']),
  monk: classRule(3, [], [CHOICE.monkSkill]),
  oracle: classRule(2, ['religion']),
  ranger: classRule(4, ['nature', 'survival']),
  rogue: classRule(7, [], [CHOICE.rogueSkill], ACCELERATED_SKILL_INCREASE_LEVELS),
  sorcerer: classRule(3),
  swashbuckler: classRule(3, ['acrobatics']),
  witch: classRule(3),
  wizard: classRule(3, ['arcana']),
  gunslinger: classRule(3),
  inventor: classRule(3, ['crafting']),
  exemplar: classRule(3),
  animist: classRule(3, ['nature', 'religion']),
  guardian: classRule(3, ['athletics']),
  magus: classRule(2, ['arcana']),
  psychic: classRule(3, ['occultism']),
  summoner: classRule(3),
  thaumaturge: classRule(3, [], [CHOICE.thaumaturgeSkill]),
  commander: classRule(2, ['society']),
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
  const options = getStructuredBackgroundAbilityText(value)
    .split(/\s*(?:,|или)\s*/iu)
    .flatMap(part => part.trim() === 'Универсальное'
      ? ALL_ATTRIBUTE_IDS
      : ATTRIBUTE_ID_BY_RUSSIAN_NAME[part.trim()] ?? [])

  // Предыстория всегда даёт два повышения, поэтому нераспознанный список
  // («-» у редких предысторий) трактуем как два универсальных повышения,
  // а не как запрет на выбор.
  if (options.length === 0) return [...ALL_ATTRIBUTE_IDS]
  return [...new Set(options)]
}

export function getStructuredBackgroundAbilityText(value: string) {
  const normalized = value.replace(/\s+/gu, ' ').trim()
  const descriptionMatch = normalized.match(
    /одно должно быть использовано для\s+(.+?)\s*,?\s+а другое/iu,
  )
  return descriptionMatch?.[1].trim() ?? normalized
}

export function hasStructuredBackgroundAbilityOptions(value: string) {
  return getStructuredBackgroundAbilityText(value)
    .split(/\s*(?:,|или)\s*/iu)
    .some(part => part.trim() === 'Универсальное'
      || Boolean(ATTRIBUTE_ID_BY_RUSSIAN_NAME[part.trim()]))
}

const LORE_CHOICE_MARKERS = [
  'или',
  'по вашему выбору',
  'связанное',
  'которому вы поклоняетесь',
]

/**
 * В справочнике предысторий Знание не вынесено в отдельное поле, а дописано
 * в конец строки обученных навыков: «Дипломатия, Знание (закон)».
 */
export function getStructuredBackgroundLore(trainedSkills: string) {
  const loreStart = trainedSkills.search(/знани/iu)
  if (loreStart < 0) return { name: '', custom: false }
  const name = trainedSkills
    .slice(loreStart)
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[.;,]+$/u, '')
  if (!name) return { name: '', custom: false }
  const normalized = name.toLocaleLowerCase('ru')
  return {
    name,
    custom: LORE_CHOICE_MARKERS.some(marker => normalized.includes(marker)),
  }
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

  const loreStart = trainedSkills.search(/знани/iu)
  const skillText = (loreStart >= 0
    ? trainedSkills.slice(0, loreStart)
    : trainedSkills
  ).toLocaleLowerCase('ru')
  const skillIds = BACKGROUND_SKILL_NAMES
    .flatMap(({ id, names }) => {
      const position = Math.min(
        ...names
          .map(name => skillText.indexOf(name))
          .filter(index => index >= 0),
      )
      return Number.isFinite(position) ? [{ id, position }] : []
    })
    .sort((left, right) => left.position - right.position)
    .map(({ id }) => id)
  const isChoice = skillIds.length > 1 && /или/iu.test(skillText)

  return {
    grantedSkills: isChoice
      ? []
      : skillIds.map(skillId => granted(skillId, 'Предыстория')),
    grantedSkillChoices: isChoice
      ? [{
          id: `background:${backgroundId}:skill`,
          label: 'Навык предыстории',
          count: 1,
          allowedSkills: skillIds,
          sourceLabel: 'Предыстория',
        }]
      : [],
  }
}
