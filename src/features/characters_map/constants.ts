import type { AttributeKey, CharacterSheet, SkillKey } from './types'

export const CHARACTERS_MAP_CHARACTERS_TABLE = 'characters_map_characters'
export const CHARACTERS_MAP_RELATIONSHIPS_TABLE = 'characters_map_relationships'
export const CHARACTERS_MAP_IMAGES_BUCKET = 'characters-map-images'

// Mirrors DND_JOURNAL_OWNER_AUTH_USER_ID: the shared TableTopGames account
// ("Anna") is the only writer, enforced by RLS in supabase/characters_map.sql.
export const CHARACTERS_MAP_OWNER_AUTH_USER_ID = '44153f98-aaf2-4935-b7b2-45fe3155edc6'

export const CHARACTER_NAME_MAX_LENGTH = 200
export const CHARACTER_DESCRIPTION_MAX_LENGTH = 10000
export const RELATIONSHIP_LABEL_MAX_LENGTH = 100
export const RELATIONSHIP_DESCRIPTION_MAX_LENGTH = 10000

export const DEFAULT_RELATIONSHIP_COLOR = '#c9a961'

export const DOT_MAX = 5
export const HUMANITY_MAX = 10
export const BLOOD_POTENCY_MAX = 10
export const STAINS_MAX = 10

export const ATTRIBUTE_GROUPS: { title: string; keys: [AttributeKey, string][] }[] = [
  {
    title: 'Физические',
    keys: [
      ['strength', 'Сила'],
      ['dexterity', 'Ловкость'],
      ['stamina', 'Выносливость'],
    ],
  },
  {
    title: 'Социальные',
    keys: [
      ['charisma', 'Харизма'],
      ['manipulation', 'Манипуляция'],
      ['composure', 'Самообладание'],
    ],
  },
  {
    title: 'Ментальные',
    keys: [
      ['intelligence', 'Интеллект'],
      ['wits', 'Сообразительность'],
      ['resolve', 'Решительность'],
    ],
  },
]

export const SKILL_GROUPS: { title: string; keys: [SkillKey, string][] }[] = [
  {
    title: 'Физические',
    keys: [
      ['athletics', 'Атлетика'],
      ['brawl', 'Драка'],
      ['craft', 'Ремесло'],
      ['drive', 'Вождение'],
      ['firearms', 'Стрельба'],
      ['larceny', 'Воровство'],
      ['melee', 'Холодное оружие'],
      ['stealth', 'Скрытность'],
      ['survival', 'Выживание'],
    ],
  },
  {
    title: 'Социальные',
    keys: [
      ['animalKen', 'Обращение с животными'],
      ['etiquette', 'Этикет'],
      ['insight', 'Проницательность'],
      ['intimidation', 'Запугивание'],
      ['leadership', 'Лидерство'],
      ['performance', 'Выступление'],
      ['persuasion', 'Убеждение'],
      ['streetwise', 'Знание улиц'],
      ['subterfuge', 'Обман'],
    ],
  },
  {
    title: 'Ментальные',
    keys: [
      ['academics', 'Академические знания'],
      ['awareness', 'Внимательность'],
      ['finance', 'Финансы'],
      ['investigation', 'Расследование'],
      ['medicine', 'Медицина'],
      ['occult', 'Оккультизм'],
      ['politics', 'Политика'],
      ['science', 'Наука'],
      ['technology', 'Технологии'],
    ],
  },
]

export function createDefaultCharacterSheet(): CharacterSheet {
  return {
    concept: '',
    clan: '',
    generation: '',
    predatorType: '',
    sire: '',
    ambition: '',
    desire: '',
    attributes: {},
    skills: {},
    disciplines: [],
    health: { max: 5, boxes: [] },
    willpower: { max: 5, boxes: [] },
    humanity: 7,
    stains: 0,
    bloodPotency: 1,
    touchstones: '',
    merits: '',
    flaws: '',
  }
}

export function withSheetDefaults(sheet: Partial<CharacterSheet> | null | undefined): CharacterSheet {
  const defaults = createDefaultCharacterSheet()
  if (!sheet || typeof sheet !== 'object') return defaults
  return {
    ...defaults,
    ...sheet,
    attributes: { ...defaults.attributes, ...sheet.attributes },
    skills: { ...defaults.skills, ...sheet.skills },
    disciplines: Array.isArray(sheet.disciplines) ? sheet.disciplines : defaults.disciplines,
    health: {
      max: sheet.health?.max ?? defaults.health.max,
      boxes: Array.isArray(sheet.health?.boxes) ? sheet.health.boxes : defaults.health.boxes,
    },
    willpower: {
      max: sheet.willpower?.max ?? defaults.willpower.max,
      boxes: Array.isArray(sheet.willpower?.boxes) ? sheet.willpower.boxes : defaults.willpower.boxes,
    },
  }
}
