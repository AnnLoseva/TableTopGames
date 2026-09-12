import type {
  AttributeKey,
  CharacterEvent,
  CharacterKind,
  CharacterSheet,
  GalleryCategory,
  RelationshipEvent,
  SkillKey,
} from './types'

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
    birthYear: null,
    birthDateLabel: '',
    baseKind: 'human',
    events: [],
    gallery: [],
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
    birthYear: typeof sheet.birthYear === 'number' ? sheet.birthYear : null,
    baseKind: sheet.baseKind === 'vampire' || sheet.baseKind === 'ghost' ? sheet.baseKind : 'human',
    events: Array.isArray(sheet.events) ? sheet.events.map(normalizeCharacterEvent) : defaults.events,
    gallery: Array.isArray(sheet.gallery) ? sheet.gallery : defaults.gallery,
  }
}

/** Month/day are a later addition, and rows written before it simply lack
 * them — every event coming out of the database goes through one of the two
 * normalizers below so the rest of the feature can treat the date fields as
 * always present (`null` = "only the year is known"). */
function normalizeMonth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const month = Math.trunc(value)
  return month >= 1 && month <= 12 ? month : null
}

function normalizeDay(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const day = Math.trunc(value)
  return day >= 1 && day <= 31 ? day : null
}

export function normalizeCharacterEvent(raw: CharacterEvent): CharacterEvent {
  const month = normalizeMonth(raw.month)
  return {
    ...raw,
    month,
    // A day without a month is meaningless — drop it rather than sort on it.
    day: month === null ? null : normalizeDay(raw.day),
    dateLabel: raw.dateLabel ?? '',
    relationshipIds: Array.isArray(raw.relationshipIds) ? raw.relationshipIds : undefined,
  }
}

/**
 * Same normalization for relationship events, plus the one-way migration of
 * the old `active` flag: `active: true` became `appears: true`, and
 * `active: false` ("the line disappears here") is dropped entirely — a
 * relationship now only ever appears. The event itself is kept, since its
 * title/description are still part of the history.
 */
export function normalizeRelationshipEvent(raw: RelationshipEvent & { active?: boolean }): RelationshipEvent {
  const month = normalizeMonth(raw.month)
  const { active, ...rest } = raw
  return {
    ...rest,
    month,
    day: month === null ? null : normalizeDay(raw.day),
    dateLabel: raw.dateLabel ?? '',
    appears: raw.appears === true || active === true ? true : undefined,
  }
}

export function createCharacterEvent(year: number): CharacterEvent {
  return { id: crypto.randomUUID(), year, month: null, day: null, dateLabel: '', title: '', description: '' }
}

export function createRelationshipEvent(year: number): RelationshipEvent {
  return { id: crypto.randomUUID(), year, month: null, day: null, dateLabel: '', title: '' }
}

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  house: 'Дом',
  pet: 'Питомец',
  event: 'Событие',
  other: 'Другое',
}

export const CHARACTER_KIND_LABELS: Record<CharacterKind, string> = {
  human: 'Человек',
  vampire: 'Вампир',
  ghost: 'Призрак',
}

export const CHARACTER_KIND_BORDER_COLORS: Record<CharacterKind, string> = {
  human: '#f2f0f7',
  vampire: '#c23b3b',
  ghost: '#9aa0a6',
}

export const DEAD_BORDER_COLOR = '#0a0a0a'
