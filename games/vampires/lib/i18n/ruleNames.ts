// Character data (attributes/skills/disciplines) is keyed by whatever trait names were
// active in rules.json/rules_eng.json when the character was saved — Russian or English,
// independent of the UI's *current* language. Code that needs a specific named trait (e.g.
// "Stamina" for the health formula) must therefore look up both possible key spellings
// rather than assuming one. Keyed by the Russian name (matches the i18n dictionary
// convention used elsewhere).
export const ATTRIBUTE_NAME_EN: Record<string, string> = {
  'Сила': 'Strength',
  'Ловкость': 'Dexterity',
  'Выносливость': 'Stamina',
  'Обаяние': 'Charisma',
  'Манипуляция': 'Manipulation',
  'Самообладание': 'Composure',
  'Интеллект': 'Intelligence',
  'Смекалка': 'Wits',
  'Упорство': 'Resolve',
}

export const SKILL_NAME_EN: Record<string, string> = {
  'Атлетика': 'Athletics',
  'Вождение': 'Drive',
  'Воровство': 'Larceny',
  'Выживание': 'Survival',
  'Драка': 'Brawl',
  'Ремесло': 'Craft',
  'Скрытность': 'Stealth',
  'Стрельба': 'Firearms',
  'Фехтование': 'Melee',
  'Запугивание': 'Intimidation',
  'Исполнение': 'Performance',
  'Лидерство': 'Leadership',
  'Обращение с животными': 'Animal Ken',
  'Проницательность': 'Insight',
  'Убеждение': 'Persuasion',
  'Уличное чутьё': 'Streetwise',
  'Хитрость': 'Subterfuge',
  'Этикет': 'Etiquette',
  'Гуманитарные науки': 'Academics',
  'Естественные науки': 'Science',
  'Медицина': 'Medicine',
  'Наблюдательность': 'Awareness',
  'Оккультизм': 'Occult',
  'Политика': 'Politics',
  'Расследование': 'Investigation',
  'Техника': 'Technology',
  'Финансы': 'Finance',
}

/** Reads attributes[ruName], falling back to the English spelling if that key is absent. */
export function getAttributeDots(attributes: Record<string, unknown> | null | undefined, ruName: string): number {
  if (!attributes) return 0
  const enName = ATTRIBUTE_NAME_EN[ruName]
  const value = attributes[ruName] ?? (enName ? attributes[enName] : undefined)
  return Number(value) || 0
}

/** Reads skills[ruName] (raw value: number or {dots,specs}), falling back to the English spelling. */
export function resolveSkillValue(skills: Record<string, unknown> | null | undefined, ruName: string): unknown {
  if (!skills) return 0
  const enName = SKILL_NAME_EN[ruName]
  return skills[ruName] ?? (enName ? skills[enName] : undefined) ?? 0
}

/**
 * Matches a trait name (from roll-pool text, any language) against a character's actual
 * attribute/skill/discipline keys (whatever language they were saved in), case-insensitively
 * and across both RU/EN spellings.
 */
export function findCrossLanguageName(name: string, names: string[]): string {
  const normalized = name.trim().toLocaleLowerCase('ru')
  const direct = names.find(candidate => candidate.toLocaleLowerCase('ru') === normalized)
  if (direct) return direct

  const enFromRu = ATTRIBUTE_NAME_EN[name.trim()] || SKILL_NAME_EN[name.trim()]
  if (enFromRu) {
    const match = names.find(candidate => candidate.toLocaleLowerCase('ru') === enFromRu.toLocaleLowerCase('ru'))
    if (match) return match
  }

  const ruFromEn = Object.entries(ATTRIBUTE_NAME_EN).find(([, en]) => en.toLocaleLowerCase('ru') === normalized)?.[0]
    ?? Object.entries(SKILL_NAME_EN).find(([, en]) => en.toLocaleLowerCase('ru') === normalized)?.[0]
  if (ruFromEn) {
    const match = names.find(candidate => candidate.toLocaleLowerCase('ru') === ruFromEn.toLocaleLowerCase('ru'))
    if (match) return match
  }

  return ''
}
