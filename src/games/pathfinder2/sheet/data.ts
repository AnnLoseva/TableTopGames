import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2StepId,
} from './types'

export const PATHFINDER2_DRAFT_STORAGE_KEY = 'pathfinder2-character-draft-v1'

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
    description: 'Шесть модификаторов персонажа',
  },
  {
    id: 'skills',
    label: 'Навыки',
    shortLabel: 'Умения',
    description: 'Обученные навыки и знания',
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

export const PATHFINDER2_SKILLS = [
  'Акробатика',
  'Аркана',
  'Атлетика',
  'Воровство',
  'Выживание',
  'Дипломатия',
  'Запугивание',
  'Медицина',
  'Обман',
  'Оккультизм',
  'Общество',
  'Природа',
  'Религия',
  'Ремесло',
  'Скрытность',
  'Исполнительство',
] as const

export const DEFAULT_PATHFINDER2_DRAFT: Pathfinder2CharacterDraft = {
  schemaVersion: 2,
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
  keyAbility: '',
  attributes: {
    strength: 0,
    dexterity: 0,
    constitution: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
  },
  trainedSkills: [],
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
  unresolvedSelections: {},
}
