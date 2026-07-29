import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2SkillId,
  Pathfinder2StepId,
} from './types'

export const PATHFINDER2_DRAFT_STORAGE_KEY = 'pathfinder2-character-draft-v3'
export const PATHFINDER2_LEGACY_DRAFT_STORAGE_KEYS = [
  'pathfinder2-character-draft-v1',
] as const

export const PATHFINDER2_STEPS: {
  id: Pathfinder2StepId
  label: string
  shortLabel: string
  description: string
}[] = [
  {
    id: 'concept',
    label: 'Концепция',
    shortLabel: 'Замысел',
    description: 'Имя, образ и уровень героя',
  },
  {
    id: 'ancestry',
    label: 'Народ',
    shortLabel: 'Корни',
    description: 'Происхождение, черты и базовые параметры',
  },
  {
    id: 'heritage',
    label: 'Наследие',
    shortLabel: 'Кровь',
    description: 'Обычное и универсальное наследие',
  },
  {
    id: 'background',
    label: 'Предыстория',
    shortLabel: 'Прошлое',
    description: 'Жизнь до приключений и первое обучение',
  },
  {
    id: 'class',
    label: 'Класс',
    shortLabel: 'Путь',
    description: 'Роль, ключевая характеристика и талант',
  },
  {
    id: 'attributes',
    label: 'Характеристики',
    shortLabel: 'Основа',
    description: 'Законные повышения из четырёх источников',
  },
  {
    id: 'skills',
    label: 'Навыки',
    shortLabel: 'Умения',
    description: 'Автоматические владения и ограниченные выборы',
  },
  {
    id: 'feats',
    label: 'Способности',
    shortLabel: 'Таланты',
    description: 'Общие способности и способности навыков',
  },
  {
    id: 'equipment',
    label: 'Снаряжение',
    shortLabel: 'Инвентарь',
    description: 'Языки, оружие, защита и припасы',
  },
  {
    id: 'review',
    label: 'Проверка',
    shortLabel: 'Финал',
    description: 'Проверьте решения и вернитесь к листу',
  },
]

export const PATHFINDER2_ATTRIBUTES: {
  key: Pathfinder2AttributeKey
  shortLabel: string
  label: string
  description: string
}[] = [
  { key: 'strength', shortLabel: 'СИЛ', label: 'Сила', description: 'Атлетика и ближний бой' },
  { key: 'dexterity', shortLabel: 'ЛОВ', label: 'Ловкость', description: 'Защита и точность' },
  { key: 'constitution', shortLabel: 'ТЕЛ', label: 'Телосложение', description: 'Стойкость и здоровье' },
  { key: 'intelligence', shortLabel: 'ИНТ', label: 'Интеллект', description: 'Знания и обучение' },
  { key: 'wisdom', shortLabel: 'МДР', label: 'Мудрость', description: 'Восприятие и воля' },
  { key: 'charisma', shortLabel: 'ХАР', label: 'Харизма', description: 'Влияние и самовыражение' },
]

export const PATHFINDER2_SKILLS: Array<{
  id: Pathfinder2SkillId
  label: string
  attribute: Pathfinder2AttributeKey
}> = [
  { id: 'acrobatics', label: 'Акробатика', attribute: 'dexterity' },
  { id: 'arcana', label: 'Аркана', attribute: 'intelligence' },
  { id: 'athletics', label: 'Атлетика', attribute: 'strength' },
  { id: 'crafting', label: 'Ремесло', attribute: 'intelligence' },
  { id: 'deception', label: 'Обман', attribute: 'charisma' },
  { id: 'diplomacy', label: 'Дипломатия', attribute: 'charisma' },
  { id: 'intimidation', label: 'Запугивание', attribute: 'charisma' },
  { id: 'medicine', label: 'Медицина', attribute: 'wisdom' },
  { id: 'nature', label: 'Природа', attribute: 'wisdom' },
  { id: 'occultism', label: 'Оккультизм', attribute: 'intelligence' },
  { id: 'performance', label: 'Исполнительство', attribute: 'charisma' },
  { id: 'religion', label: 'Религия', attribute: 'wisdom' },
  { id: 'society', label: 'Общество', attribute: 'intelligence' },
  { id: 'stealth', label: 'Скрытность', attribute: 'dexterity' },
  { id: 'survival', label: 'Выживание', attribute: 'wisdom' },
  { id: 'thievery', label: 'Воровство', attribute: 'dexterity' },
]

export function createDefaultPathfinder2Draft(): Pathfinder2CharacterDraft {
  return {
    schemaVersion: 3,
    name: '',
    player: '',
    pronouns: '',
    concept: '',
    level: 1,
    portrait: '',
    ancestryId: '',
    heritageId: '',
    versatileHeritageId: '',
    backgroundId: '',
    classId: '',
    subclassId: '',
    attributeChoices: {
      ancestryMode: 'standard',
      ancestryFreeBoosts: [],
      backgroundLimitedBoost: null,
      backgroundFreeBoost: null,
      classKeyBoost: null,
      finalFreeBoosts: [],
      levelBoosts: {
        5: [],
        10: [],
        15: [],
        20: [],
      },
    },
    skillChoices: {
      grantedChoiceSelections: {},
      classFreeSkills: [],
      intelligenceSkills: [],
      replacementSkills: {},
      skillIncreases: [],
      suggestedSkills: [],
    },
    lore: '',
    ancestryFeatIds: [],
    classFeatIds: [],
    skillFeatIds: [],
    generalFeatIds: [],
    languages: '',
    equipment: '',
    notes: '',
    currentHp: 0,
    tempHp: 0,
    needsRulesRebuild: false,
    legacySnapshot: null,
    unresolvedSelections: {},
  }
}

export const DEFAULT_PATHFINDER2_DRAFT = createDefaultPathfinder2Draft()
