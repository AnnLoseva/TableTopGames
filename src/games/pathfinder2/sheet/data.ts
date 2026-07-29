import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2SkillId,
  Pathfinder2StepId,
} from './types'

export const PATHFINDER2_DRAFT_STORAGE_KEY = 'pathfinder2-character-draft-v4'
export const PATHFINDER2_LEGACY_DRAFT_STORAGE_KEYS = [
  'pathfinder2-character-draft-v3',
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
    id: 'initial-attributes',
    label: 'Начальные характеристики',
    shortLabel: 'Основа',
    description: 'Все шесть модификаторов начинают с +0',
  },
  {
    id: 'ancestry',
    label: 'Народ',
    shortLabel: 'Корни',
    description: 'Народ, наследие и решения происхождения',
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
    id: 'final-attributes',
    label: 'Итоговые характеристики',
    shortLabel: 'Повышения',
    description: 'Законные повышения и полный breakdown',
  },
  {
    id: 'features',
    label: 'Особенности и владения',
    shortLabel: 'Умения',
    description: 'Владения, навыки, особенности, черты и магия',
  },
  {
    id: 'equipment',
    label: 'Снаряжение',
    shortLabel: 'Инвентарь',
    description: 'Покупки, экипировка, валюта и Bulk',
  },
  {
    id: 'calculations',
    label: 'Расчёт параметров',
    shortLabel: 'Итоги',
    description: 'Read-only параметры с объяснением источников',
  },
  {
    id: 'details',
    label: 'Заключительные сведения',
    shortLabel: 'Детали',
    description: 'Языки, вера, связи и заметки',
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
      voluntaryFlaws: [],
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
