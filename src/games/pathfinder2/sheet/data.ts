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
    id: 'origin',
    label: 'Происхождение',
    shortLabel: 'Корни',
    description: 'Народ, наследие и предыстория',
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
    id: 'equipment',
    label: 'Снаряжение',
    shortLabel: 'Финал',
    description: 'Языки, способности и инвентарь',
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

export const PATHFINDER2_ANCESTRIES = [
  {
    id: 'human',
    name: 'Человек',
    tagline: 'Гибкость и амбиции',
    hp: 8,
    speed: 25,
    heritages: ['Умелый человек', 'Зимостойкий человек', 'Разностороннее наследие'],
  },
  {
    id: 'elf',
    name: 'Эльф',
    tagline: 'Долгая память и проворство',
    hp: 6,
    speed: 30,
    heritages: ['Лесной эльф', 'Древний эльф', 'Шепчущий эльф'],
  },
  {
    id: 'dwarf',
    name: 'Дварф',
    tagline: 'Крепость камня и традиций',
    hp: 10,
    speed: 20,
    heritages: ['Кузнечный дварф', 'Древний дварф', 'Дварф-смертоносец'],
  },
  {
    id: 'halfling',
    name: 'Полурослик',
    tagline: 'Удача, любопытство и отвага',
    hp: 6,
    speed: 25,
    heritages: ['Сумеречный полурослик', 'Кочевой полурослик', 'Дикий полурослик'],
  },
  {
    id: 'goblin',
    name: 'Гоблин',
    tagline: 'Энергия, огонь и находчивость',
    hp: 6,
    speed: 25,
    heritages: ['Несокрушимый гоблин', 'Острозубый гоблин', 'Снежный гоблин'],
  },
  {
    id: 'orc',
    name: 'Орк',
    tagline: 'Выносливость и прямота',
    hp: 10,
    speed: 25,
    heritages: ['Дождевой орк', 'Могильный орк', 'Глубинный орк'],
  },
] as const

export const PATHFINDER2_BACKGROUNDS = [
  {
    id: 'acolyte',
    name: 'Послушник',
    detail: 'Мудрость или Интеллект · Религия',
  },
  {
    id: 'artisan',
    name: 'Ремесленник',
    detail: 'Сила или Интеллект · Ремесло',
  },
  {
    id: 'criminal',
    name: 'Преступник',
    detail: 'Ловкость или Интеллект · Скрытность',
  },
  {
    id: 'field-medic',
    name: 'Полевой медик',
    detail: 'Телосложение или Мудрость · Медицина',
  },
  {
    id: 'farmhand',
    name: 'Батрак',
    detail: 'Сила или Телосложение · Атлетика',
  },
  {
    id: 'scholar',
    name: 'Учёный',
    detail: 'Интеллект или Мудрость · академический навык',
  },
] as const

export const PATHFINDER2_CLASSES = [
  {
    id: 'fighter',
    name: 'Воин',
    role: 'Мастер оружия и контроля поля',
    hp: 10,
    keyAbilities: ['strength', 'dexterity'] satisfies Pathfinder2AttributeKey[],
    accent: 'Сталь',
  },
  {
    id: 'rogue',
    name: 'Плут',
    role: 'Эксперт, разведчик и точный боец',
    hp: 8,
    keyAbilities: ['dexterity'] satisfies Pathfinder2AttributeKey[],
    accent: 'Тень',
  },
  {
    id: 'wizard',
    name: 'Волшебник',
    role: 'Подготовленная тайная магия',
    hp: 6,
    keyAbilities: ['intelligence'] satisfies Pathfinder2AttributeKey[],
    accent: 'Аркана',
  },
  {
    id: 'cleric',
    name: 'Жрец',
    role: 'Божественная магия и вера',
    hp: 8,
    keyAbilities: ['wisdom'] satisfies Pathfinder2AttributeKey[],
    accent: 'Вера',
  },
  {
    id: 'ranger',
    name: 'Следопыт',
    role: 'Охотник и исследователь',
    hp: 10,
    keyAbilities: ['strength', 'dexterity'] satisfies Pathfinder2AttributeKey[],
    accent: 'Тропа',
  },
  {
    id: 'bard',
    name: 'Бард',
    role: 'Оккультная магия и поддержка',
    hp: 8,
    keyAbilities: ['charisma'] satisfies Pathfinder2AttributeKey[],
    accent: 'Муза',
  },
] as const

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
  name: '',
  player: '',
  pronouns: '',
  concept: '',
  level: 1,
  ancestryId: '',
  heritage: '',
  backgroundId: '',
  classId: '',
  keyAbility: '',
  specialization: '',
  classFeat: '',
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
  languages: '',
  generalFeat: '',
  equipment: '',
  notes: '',
}
