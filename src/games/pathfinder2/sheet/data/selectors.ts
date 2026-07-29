import type {
  Pathfinder2AncestryRule,
  Pathfinder2AttributeKey,
  Pathfinder2BackgroundRule,
  Pathfinder2ClassRule,
  Pathfinder2FeatRule,
  Pathfinder2HeritageRule,
  Pathfinder2RulesCatalog,
  Pathfinder2VersatileHeritageRule,
} from '../types'

export const ATTRIBUTE_LABELS: Record<Pathfinder2AttributeKey, string> = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  constitution: 'Телосложение',
  intelligence: 'Интеллект',
  wisdom: 'Мудрость',
  charisma: 'Харизма',
}

export const RARITY_LABELS: Record<string, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  unique: 'Уникальный',
}

export const SIZE_LABELS: Record<string, string> = {
  tiny: 'Крошечный',
  small: 'Маленький',
  medium: 'Средний',
  large: 'Большой',
  huge: 'Огромный',
  gargantuan: 'Гигантский',
}

export const SENSE_LABELS: Record<string, string> = {
  'low-light-vision': 'Сумеречное зрение',
  darkvision: 'Тёмное зрение',
  scent: 'Нюх',
}

export const TRAIT_LABELS: Record<string, string> = {
  Human: 'Человек',
  Humanoid: 'Гуманоид',
  Elf: 'Эльф',
  Dwarf: 'Дварф',
  Gnome: 'Гном',
  Goblin: 'Гоблин',
  Halfling: 'Полурослик',
  Orc: 'Орк',
  General: 'Общая',
  Skill: 'Навык',
  Mythic: 'Мифическая',
  Legacy: 'Доремастерская',
}

export const BACKGROUND_CATEGORY_LABELS: Record<string, string> = {
  general: 'Общая',
  regional: 'Региональная',
  adventure: 'Приключенческая',
}

export const PROFICIENCY_LABELS: Record<string, string> = {
  untrained: 'Не обучен',
  trained: 'Обучен',
  expert: 'Эксперт',
  master: 'Мастер',
  legendary: 'Легенда',
}

export const ANCESTRY_ARTWORK: Partial<Record<string, string>> = {}

export function getAllAncestries(catalog: Pathfinder2RulesCatalog) {
  return catalog.ancestries
}

export function getAncestryById(
  catalog: Pathfinder2RulesCatalog,
  id: string,
): Pathfinder2AncestryRule | undefined {
  return catalog.ancestries.find(ancestry => ancestry.id === id)
}

export function getAncestryHeritages(
  catalog: Pathfinder2RulesCatalog,
  ancestryId: string,
): Pathfinder2HeritageRule[] {
  return getAncestryById(catalog, ancestryId)?.heritages ?? []
}

export function getHeritageById(
  catalog: Pathfinder2RulesCatalog,
  ancestryId: string,
  heritageId: string,
) {
  return getAncestryHeritages(catalog, ancestryId)
    .find(heritage => heritage.id === heritageId)
}

export function getVersatileHeritages(
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2VersatileHeritageRule[] {
  return catalog.versatileHeritages
}

export function getVersatileHeritageById(
  catalog: Pathfinder2RulesCatalog,
  id: string,
) {
  return catalog.versatileHeritages.find(heritage => heritage.id === id)
}

export function getAllBackgrounds(catalog: Pathfinder2RulesCatalog) {
  return catalog.backgrounds
}

export function getBackgroundById(
  catalog: Pathfinder2RulesCatalog,
  id: string,
): Pathfinder2BackgroundRule | undefined {
  return catalog.backgrounds.find(background => background.id === id)
}

export function getAllClasses(catalog: Pathfinder2RulesCatalog) {
  return catalog.classes
}

export function getClassById(
  catalog: Pathfinder2RulesCatalog,
  id: string,
): Pathfinder2ClassRule | undefined {
  return catalog.classes.find(characterClass => characterClass.id === id)
}

export function getFeatById(
  catalog: Pathfinder2RulesCatalog,
  id: string,
): Pathfinder2FeatRule | undefined {
  return [...catalog.generalFeats, ...catalog.skillFeats, ...catalog.mythicFeats]
    .find(feat => feat.id === id)
}

export function getClassFeatureById(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  id: string,
) {
  return getClassById(catalog, classId)?.features.find(feature => feature.id === id)
}

export function getSubclassById(
  catalog: Pathfinder2RulesCatalog,
  classId: string,
  id: string,
) {
  return getClassById(catalog, classId)?.specializations
    .find(specialization => specialization.id === id)
}

export function displayAttribute(value: string) {
  if (value === 'free') return 'Свободное повышение'
  return ATTRIBUTE_LABELS[value as Pathfinder2AttributeKey] ?? value
}

export function displayRarity(value: string) {
  return RARITY_LABELS[value] ?? value
}

export function displaySize(value: string) {
  return SIZE_LABELS[value] ?? value
}

export function displaySense(value: string) {
  return SENSE_LABELS[value] ?? value
}

export function displayTrait(value: string) {
  return TRAIT_LABELS[value] ?? value
}

export function displayProficiency(value: string) {
  const normalized = value.toLowerCase()
  return Object.entries(PROFICIENCY_LABELS)
    .find(([key]) => normalized.includes(key))?.[1] ?? value
}

export function splitRuleParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
}

export function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase('ru')
}

export function includesSearch(query: string, values: Array<string | string[] | null>) {
  const normalized = normalizeSearchValue(query)
  if (!normalized) return true
  return values.some(value => (
    Array.isArray(value)
      ? value.some(entry => normalizeSearchValue(entry).includes(normalized))
      : normalizeSearchValue(value ?? '').includes(normalized)
  ))
}

export function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right, 'ru'))
}
