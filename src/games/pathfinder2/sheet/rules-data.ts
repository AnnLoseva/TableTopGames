import 'server-only'

import ancestriesRules from '../Rules/ancestries.json'
import adventuringGearRules from '../Rules/adventuring-gear.json'
import alchemicalItemRules from '../Rules/alchemical-items.json'
import archetypesRules from '../Rules/archetypes.json'
import armorRules from '../Rules/armor.json'
import artifactRules from '../Rules/artifacts.json'
import assistiveItemRules from '../Rules/assistive-items.json'
import backgroundsRules from '../Rules/backgrounds.json'
import classesRules from '../Rules/classes.json'
import contractRules from '../Rules/contracts.json'
import consumableRules from '../Rules/consumables.json'
import customizationRules from '../Rules/customizations.json'
import featsRules from '../Rules/feats.json'
import graftRules from '../Rules/grafts.json'
import heldItemRules from '../Rules/held-items.json'
import materialRules from '../Rules/materials.json'
import relicRules from '../Rules/relics.json'
import runeRules from '../Rules/runes.json'
import shieldRules from '../Rules/shields.json'
import siegeWeaponRules from '../Rules/siege-weapons.json'
import snareRules from '../Rules/snares.json'
import spellheartRules from '../Rules/spellhearts.json'
import spellsRules from '../Rules/spells.json'
import staffRules from '../Rules/staves.json'
import structureRules from '../Rules/structures.json'
import tattooRules from '../Rules/tattoos.json'
import vehicleRules from '../Rules/vehicles.json'
import wandRules from '../Rules/wands.json'
import weaponRules from '../Rules/weapons.json'
import wornItemRules from '../Rules/worn-items.json'
import armorCatalog from '../Rules/catalogs/armor.json'
import ancestryFeatsCatalog from '../Rules/catalogs/ancestry-feats.json'
import classFeatsCatalog from '../Rules/catalogs/class-feats.json'
import classProgressionCatalog from '../Rules/catalogs/class-progression.json'
import deitiesCatalog from '../Rules/catalogs/deities.json'
import equipmentCatalog from '../Rules/catalogs/equipment.json'
import languagesCatalog from '../Rules/catalogs/languages.json'
import shieldsCatalog from '../Rules/catalogs/shields.json'
import traitsCatalog from '../Rules/catalogs/traits.json'
import weaponsCatalog from '../Rules/catalogs/weapons.json'
import { auditPathfinder2RuleDocuments } from './data/catalog-audit'
import {
  getSpecializationGrantedSkills,
  getStructuredBackgroundAbilityText,
  getStructuredBackgroundAbilityOptions,
  getStructuredBackgroundLore,
  getStructuredBackgroundSkillRules,
  getStructuredClassSkillRules,
  hasStructuredBackgroundAbilityOptions,
} from './rules/creation/structured-rules'
import type {
  Pathfinder2AncestryRule,
  Pathfinder2ArmorRule,
  Pathfinder2AttributeKey,
  Pathfinder2BackgroundRule,
  Pathfinder2ClassProgressionRule,
  Pathfinder2ClassRoleplayingRule,
  Pathfinder2ClassRule,
  Pathfinder2CharacterSource,
  Pathfinder2DeityRule,
  Pathfinder2EquipmentItem,
  Pathfinder2FeatRule,
  Pathfinder2LanguageRule,
  Pathfinder2ProficiencyGrant,
  Pathfinder2ProficiencyRank,
  Pathfinder2Requirement,
  Pathfinder2RuleFeature,
  Pathfinder2RuleSource,
  Pathfinder2RulesCatalog,
  Pathfinder2ShieldRule,
  Pathfinder2SpecialAbilityRule,
  Pathfinder2SpellRule,
  Pathfinder2SpellTradition,
  Pathfinder2TraitRule,
  Pathfinder2VersatileHeritageRule,
  Pathfinder2WeaponRule,
} from './types'

type RawRuleFeature = {
  id?: string
  name?: string
  desc?: string
  description?: string
  level?: number
}

type RawAncestry = {
  id?: string
  name?: string
  tagline?: string
  description?: string
  rarity?: string
  traits?: string[]
  youMight?: string[]
  othersProbably?: string[]
  popularEdicts?: string[]
  popularAnathema?: string[]
  sampleNames?: string
  hp?: number
  speed?: number
  size?: string
  abilityBoosts?: string[]
  abilityFlaw?: string | null
  languages?: string[]
  bonusLanguages?: string
  senses?: string[]
  specialAbilities?: Pathfinder2SpecialAbilityRule[]
  heritages?: RawRuleFeature[]
  sourceBook?: string
}

type RawVersatileHeritage = {
  id?: string
  name?: string
  altName?: string
  tagline?: string
  description?: string
  traits?: string[]
  senses?: string[]
  mechanics?: string
  sourceBook?: string
  negativeHealing?: boolean
}

type RawBackground = {
  id?: string
  name?: string
  description?: string
  rarity?: string
  abilityBoosts?: string
  trainedSkills?: string
  trainedLore?: string
  skillFeat?: string
  sourceBook?: string
  tab?: string
  region?: string | null
}

type RawClassRoleplaying = Partial<Pathfinder2ClassRoleplayingRule>

type RawClass = {
  id?: string
  name?: string
  description?: string
  rarity?: string
  role?: string
  hp?: number
  keyAbility?: string
  perception?: string
  fortitude?: string
  reflex?: string
  will?: string
  skills?: string
  attacks?: string
  defenses?: string
  classDC?: string
  spellTradition?: string | null
  spellSlots?: Record<string, number[]> | null
  keyTerms?: RawRuleFeature[]
  roleplaying?: RawClassRoleplaying
  features?: RawRuleFeature[]
  subclasses?: RawRuleFeature[]
  sourceBook?: string
}

type RawFeat = {
  id?: string
  name?: string
  nameEn?: string
  level?: number
  description?: string
  prerequisites?: string | null
  requirements?: Pathfinder2Requirement[]
  traits?: string[]
  skill?: string
  ancestryIds?: string[]
  classIds?: string[]
  sourceBook?: string
}

type RawSpell = {
  id?: string
  name?: string
  nameEn?: string
  level?: number
  actions?: string
  rarity?: string
  traits?: string[]
  traditions?: string[]
  sourceBook?: string
  type?: string
  description?: string
}

type RawRuleDocument<T> = {
  title?: string
  version?: string
  source?: string
} & T

const ATTRIBUTE_KEYS: Pathfinder2AttributeKey[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
]

function safeArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function stableFeatureId(prefix: string, feature: RawRuleFeature, index: number) {
  if (feature.id) return feature.id
  const slug = (feature.name ?? `option-${index + 1}`)
    .toLocaleLowerCase('ru')
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
  return `${prefix}-${slug || index + 1}`
}

function toFeature(
  prefix: string,
  feature: RawRuleFeature,
  index: number,
): Pathfinder2RuleFeature {
  return {
    id: stableFeatureId(prefix, feature, index),
    name: feature.name ?? 'Без названия',
    description: feature.description ?? feature.desc ?? '',
    ...(typeof feature.level === 'number' ? { level: feature.level } : {}),
  }
}

function toFeat(feat: RawFeat, index: number, group: string): Pathfinder2FeatRule {
  const category = group === 'skill'
    ? 'skill'
    : group === 'mythic'
      ? 'mythic'
      : 'general'
  return {
    id: feat.id ?? `${group}-${index + 1}`,
    name: feat.name ?? 'Без названия',
    level: typeof feat.level === 'number' ? feat.level : 1,
    description: feat.description ?? '',
    prerequisites: feat.prerequisites ?? null,
    requirements: feat.prerequisites
      ? [{ type: 'custom', description: feat.prerequisites }]
      : [],
    category,
    traits: safeArray(feat.traits),
    ...(feat.skill ? { skill: feat.skill } : {}),
    ...(feat.sourceBook ? { sourceBook: feat.sourceBook } : {}),
  }
}

function toCatalogFeat(
  feat: RawFeat,
  index: number,
  category: 'ancestry' | 'class',
): Pathfinder2FeatRule {
  return {
    id: feat.id ?? `${category}-feat-${index + 1}`,
    name: feat.name ?? 'Без названия',
    ...(feat.nameEn ? { nameEn: feat.nameEn } : {}),
    level: typeof feat.level === 'number' ? feat.level : 1,
    description: feat.description ?? '',
    prerequisites: feat.prerequisites ?? null,
    requirements: safeArray(feat.requirements),
    category,
    traits: safeArray(feat.traits),
    ...(category === 'ancestry'
      ? { ancestryIds: safeArray(feat.ancestryIds) }
      : { classIds: safeArray(feat.classIds) }),
    ...(feat.sourceBook ? { sourceBook: feat.sourceBook } : {}),
  }
}

function spellTradition(value: string): Pathfinder2SpellTradition | null {
  const normalized = value.trim().toLocaleLowerCase('ru')
  if (normalized.includes('мистическ') || normalized.includes('аркан')) return 'arcane'
  if (normalized.includes('сакральн') || normalized.includes('божествен')) return 'divine'
  if (normalized.includes('оккульт')) return 'occult'
  if (normalized.includes('первобыт') || normalized.includes('первород')) return 'primal'
  return null
}

function toSpell(
  spell: RawSpell,
  index: number,
  fallbackType: 'spell' | 'cantrip',
): Pathfinder2SpellRule {
  const rawTraditions = safeArray(spell.traditions)
  const type = spell.type === 'focus'
    ? 'focus'
    : spell.type === 'cantrip'
      ? 'cantrip'
      : fallbackType
  const rarity = spell.rarity === 'uncommon'
    || spell.rarity === 'rare'
    || spell.rarity === 'unique'
    ? spell.rarity
    : 'common'
  return {
    id: spell.id ?? `${type}-${index + 1}`,
    name: spell.name ?? 'Без названия',
    nameEn: spell.nameEn ?? '',
    level: typeof spell.level === 'number' ? spell.level : type === 'cantrip' ? 0 : 1,
    actions: spell.actions ?? '',
    rarity,
    traits: safeArray(spell.traits),
    traditions: Array.from(new Set(
      rawTraditions
        .map(spellTradition)
        .filter((value): value is Pathfinder2SpellTradition => Boolean(value)),
    )),
    rawTraditions,
    sourceBook: spell.sourceBook ?? '',
    type,
    description: spell.description ?? '',
  }
}

function proficiencyRank(value: string | undefined): Pathfinder2ProficiencyRank {
  const normalized = (value ?? '').trim().toLocaleLowerCase('en')
  if (normalized === 'legendary') return 'legendary'
  if (normalized === 'master') return 'master'
  if (normalized === 'expert') return 'expert'
  if (normalized === 'trained') return 'trained'
  return 'untrained'
}

function proficiencyTargets(value: string, category: 'weapon' | 'armor') {
  const normalized = value.toLocaleLowerCase('ru')
  if (category === 'weapon') {
    const targets: string[] = []
    if (normalized.includes('прост')) targets.push('simple')
    if (normalized.includes('воинск')) targets.push('martial')
    if (normalized.includes('продвин')) targets.push('advanced')
    if (normalized.includes('безоруж')) targets.push('unarmed')
    if (normalized.includes('бомб')) targets.push('alchemical-bomb')
    if (normalized.includes('огнестрел')) targets.push('firearm')
    if (normalized.includes('избран')) targets.push('deity-favored')
    if (normalized.includes('особ')) targets.push('special')
    return targets
  }
  const targets: string[] = []
  if (normalized.includes('вся броня')) targets.push('all-armor')
  if (normalized.includes('лёгк')) targets.push('light')
  if (normalized.includes('средн')) targets.push('medium')
  if (normalized.includes('тяж')) targets.push('heavy')
  if (normalized.includes('без брони')) targets.push('unarmored')
  return targets
}

function equipmentProficiencyGrants(
  value: string,
  category: 'weapon' | 'armor',
  source: Pathfinder2ProficiencyGrant['source'],
) {
  return value.split(',').flatMap((part): Pathfinder2ProficiencyGrant[] => {
    const match = part.match(/\((trained|expert|master|legendary)\)/i)
    if (!match) return []
    const rank = proficiencyRank(match[1])
    return proficiencyTargets(part, category).map(targetId => ({
      category,
      targetId,
      rank,
      level: 1,
      source,
    }))
  })
}

function classChoiceLabel(classId: string) {
  const labels: Record<string, string> = {
    alchemist: 'Исследовательское поле',
    barbarian: 'Инстинкт',
    bard: 'Муза',
    champion: 'Дело чемпиона',
    cleric: 'Доктрина',
    druid: 'Друидический орден',
    guardian: 'Тактика стража',
    investigator: 'Методология',
    kineticist: 'Врата кинетика',
    magus: 'Гибридное исследование',
    oracle: 'Тайна',
    psychic: 'Сознательный разум',
    ranger: 'Охотничье преимущество',
    rogue: 'Плутовской рэкет',
    sorcerer: 'Кровная линия',
    summoner: 'Эйдолон',
    swashbuckler: 'Стиль',
    thaumaturge: 'Орудие',
    witch: 'Покровитель',
    wizard: 'Арканная школа',
    gunslinger: 'Путь стрелка',
    inventor: 'Инновация',
    exemplar: 'Иконическая искра',
    animist: 'Практика',
    commander: 'Тактическая доктрина',
  }
  return labels[classId] ?? 'Обязательный выбор класса'
}

function parseKeyAbilities(value = ''): Pathfinder2AttributeKey[] {
  const normalized = value.toLowerCase()
  return ATTRIBUTE_KEYS.filter(key => normalized.includes(key))
}

function canonicalFeatName(value: string, feats: Pathfinder2FeatRule[]) {
  const withoutEnglishName = value.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const normalized = withoutEnglishName
    .toLocaleLowerCase('ru')
    .replace(/\s+/g, ' ')
  return feats.find(feat => (
    feat.name.toLocaleLowerCase('ru').replace(/\s+/g, ' ') === normalized
  ))?.name
    ?? withoutEnglishName
}

function catalogEntries(value: unknown): unknown[] {
  return Array.isArray((value as Record<string, unknown>)?.entries) ? (value as Record<string, unknown>).entries as unknown[] : []
}

const LANGUAGE_ALIASES: Record<string, string> = {
  всеобщий: 'common',
  дворфийский: 'dwarven',
  эльфийский: 'elven',
  гномий: 'gnomish',
  гномьего: 'gnomish',
  гоблинский: 'goblin',
  гоблинского: 'goblin',
  'язык полуросликов': 'halfling',
  полуросличий: 'halfling',
  орочий: 'orcish',
  орочьего: 'orcish',
  драконий: 'draconic',
  драконьего: 'draconic',
  фейский: 'sylvan',
  фейского: 'sylvan',
  подземный: 'undercommon',
  небесный: 'celestial',
  эмпирейский: 'celestial',
  инфернальный: 'infernal',
  абиссальный: 'abyssal',
  акло: 'aklo',
  акван: 'aquan',
  талассийский: 'aquan',
  ауран: 'auran',
  игнан: 'ignan',
  терран: 'terran',
  терранский: 'terran',
  некрил: 'necril',
  'язык тени': 'shadowtongue',
  теневой: 'shadowtongue',
  йотунский: 'giant',
  'язык великанов': 'giant',
  'язык кхоло': 'gnoll',
  гноллий: 'gnoll',
  'язык ирукси': 'iruxi',
  ирукси: 'iruxi',
}

function normalizedLanguageName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/[.,;:()]/g, '')
}

function languageIdForName(value: string, languages: Pathfinder2LanguageRule[]) {
  const normalized = normalizedLanguageName(value)
  const direct = languages.find(language => (
    normalizedLanguageName(language.name) === normalized
    || normalizedLanguageName(language.id) === normalized
  ))
  return direct?.id ?? LANGUAGE_ALIASES[normalized] ?? null
}

function languageIdsInText(value: string, languages: Pathfinder2LanguageRule[]) {
  const normalized = value.toLocaleLowerCase('ru')
  return Array.from(new Set(languages.flatMap(language => {
    const aliases = Object.entries(LANGUAGE_ALIASES)
      .filter(([, id]) => id === language.id)
      .map(([name]) => name)
    const names = [language.name, language.id, ...aliases]
    return names.some(name => normalized.includes(normalizedLanguageName(name)))
      ? [language.id]
      : []
  })))
}

function ancestryLanguageRules(
  ancestry: RawAncestry,
  languages: Pathfinder2LanguageRule[],
) {
  const grantedLanguageIds = safeArray(ancestry.languages)
    .map(language => languageIdForName(language, languages))
    .filter((id): id is string => Boolean(id))
  const bonusText = ancestry.bonusLanguages ?? ''
  const fixedChoiceMatch = bonusText.match(/^\s*(\d+)\s*\+/)
  const bonusChoiceCount = fixedChoiceMatch ? Number(fixedChoiceMatch[1]) : 0
  const listedIds = languageIdsInText(bonusText, languages)
  const regionalFallback = /регион|доступн/i.test(bonusText)
    ? languages.filter(language => language.rarity === 'common').map(language => language.id)
    : []
  return {
    grantedLanguageIds: Array.from(new Set(grantedLanguageIds)),
    bonusChoiceCount,
    bonusLanguageIds: Array.from(new Set([...listedIds, ...regionalFallback]))
      .filter(id => !grantedLanguageIds.includes(id)),
  }
}

function sourceFrom(
  id: Pathfinder2RuleSource['id'],
  document: RawRuleDocument<object>,
): Pathfinder2RuleSource {
  return {
    id,
    title: document.title ?? id,
    version: document.version ?? 'без версии',
    source: document.source ?? '',
  }
}

function normalizeRoleplaying(value?: RawClassRoleplaying): Pathfinder2ClassRoleplayingRule {
  return {
    combat: value?.combat ?? '',
    social: value?.social ?? '',
    exploration: value?.exploration ?? '',
    downtime: value?.downtime ?? '',
    youMight: safeArray(value?.youMight),
    othersProbably: safeArray(value?.othersProbably),
  }
}

function validateDocuments(documents: {
  ancestries?: unknown
  versatileHeritages?: unknown
  backgrounds?: unknown
  classes?: unknown
  generalFeats?: unknown
  skillFeats?: unknown
  classProgression?: Pathfinder2ClassProgressionRule[]
}): string[] {
  const warnings: string[] = []
  for (const [label, value] of Object.entries(documents)) {
    if (!Array.isArray(value)) warnings.push(`Справочник «${label}» имеет неизвестный формат.`)
  }
  const progressionIds = new Set(
    safeArray(documents.classProgression).map(entry => entry.classId),
  )
  const classesWithoutProgression = safeArray(documents.classes as RawClass[])
    .map(characterClass => characterClass.id ?? characterClass.name ?? '?')
    .filter(classId => !progressionIds.has(classId))
  if (classesWithoutProgression.length > 0) {
    warnings.push(
      `Нет таблицы развития 1–20 для классов: ${classesWithoutProgression.join(', ')}.`,
    )
  }
  const backgroundsWithoutBoosts = safeArray(documents.backgrounds as RawBackground[])
    .filter(background => !hasStructuredBackgroundAbilityOptions(
      background.abilityBoosts ?? background.description ?? '',
    ))
    .map(background => background.id ?? background.name ?? '?')
  if (backgroundsWithoutBoosts.length > 0) {
    warnings.push(
      `В предысториях не указаны повышения характеристик (взяты два универсальных): ${
        backgroundsWithoutBoosts.join(', ')
      }.`,
    )
  }
  return warnings
}

export function getPathfinder2RulesCatalog(): Pathfinder2RulesCatalog {
  const ancestryDocument = ancestriesRules as RawRuleDocument<{
    ancestries?: RawAncestry[]
    versatileHeritages?: RawVersatileHeritage[]
  }>
  const backgroundDocument = backgroundsRules as RawRuleDocument<{
    backgrounds?: RawBackground[]
  }>
  const classDocument = classesRules as RawRuleDocument<{ classes?: RawClass[] }>
  const featDocument = featsRules as RawRuleDocument<{
    feats?: {
      general?: RawFeat[]
      skill?: RawFeat[]
      mythic?: RawFeat[]
    }
  }>
  const spellDocument = spellsRules as RawRuleDocument<{
    spells?: RawSpell[]
    cantrips?: RawSpell[]
  }>
  const dataAvailability = auditPathfinder2RuleDocuments({
    ancestries: ancestryDocument,
    backgrounds: backgroundDocument,
    classes: classDocument,
    feats: featDocument,
    archetypes: archetypesRules,
    spells: spellsRules,
    armor: armorRules,
    weapons: weaponRules,
    shields: shieldRules,
    ancestryFeats: ancestryFeatsCatalog,
    classFeats: classFeatsCatalog,
    classProgression: classProgressionCatalog,
    normalizedEquipment: equipmentCatalog,
    normalizedWeapons: weaponsCatalog,
    normalizedArmor: armorCatalog,
    normalizedShields: shieldsCatalog,
    deities: deitiesCatalog,
    languages: languagesCatalog,
    traits: traitsCatalog,
    equipment: [
      adventuringGearRules,
      alchemicalItemRules,
      artifactRules,
      assistiveItemRules,
      contractRules,
      consumableRules,
      customizationRules,
      graftRules,
      heldItemRules,
      materialRules,
      relicRules,
      runeRules,
      siegeWeaponRules,
      snareRules,
      spellheartRules,
      staffRules,
      structureRules,
      tattooRules,
      vehicleRules,
      wandRules,
      wornItemRules,
    ],
  })

  const rawGeneralFeats = safeArray(featDocument.feats?.general)
  const rawSkillFeats = safeArray(featDocument.feats?.skill)
  const rawMythicFeats = safeArray(featDocument.feats?.mythic)
  const generalFeats = rawGeneralFeats.map((feat, index) => toFeat(feat, index, 'general'))
  const skillFeats = rawSkillFeats.map((feat, index) => toFeat(feat, index, 'skill'))
  const mythicFeats = rawMythicFeats.map((feat, index) => toFeat(feat, index, 'mythic'))
  const ancestryFeats = (catalogEntries(ancestryFeatsCatalog) as RawFeat[])
    .map((feat, index) => toCatalogFeat(feat, index, 'ancestry'))
  const classFeats = (catalogEntries(classFeatsCatalog) as RawFeat[])
    .map((feat, index) => toCatalogFeat(feat, index, 'class'))
  const classProgression = catalogEntries(classProgressionCatalog) as Pathfinder2ClassProgressionRule[]
  const languages = catalogEntries(languagesCatalog) as Pathfinder2LanguageRule[]
  const deities = catalogEntries(deitiesCatalog) as Pathfinder2DeityRule[]
  const traits = catalogEntries(traitsCatalog) as Pathfinder2TraitRule[]
  const normalizedSpells = safeArray(spellDocument.spells)
    .map((spell, index) => toSpell(spell, index, 'spell'))
  const normalizedCantrips = safeArray(spellDocument.cantrips)
    .map((spell, index) => toSpell(spell, index, 'cantrip'))
  const spells = normalizedSpells.filter(spell => spell.type === 'spell')
  const cantrips = normalizedCantrips.filter(spell => spell.type === 'cantrip')
  const focusSpells = [
    ...normalizedCantrips,
    ...normalizedSpells,
  ].filter(spell => spell.type === 'focus')

  const ancestries: Pathfinder2AncestryRule[] = safeArray(ancestryDocument.ancestries)
    .map((ancestry, ancestryIndex) => {
      const ancestryId = ancestry.id ?? `ancestry-${ancestryIndex + 1}`
      const ancestryName = ancestry.name ?? 'Неизвестный народ'
      return {
        id: ancestryId,
        name: ancestryName,
        tagline: ancestry.tagline ?? '',
        description: ancestry.description ?? '',
        rarity: ancestry.rarity ?? 'common',
        traits: safeArray(ancestry.traits),
        youMight: safeArray(ancestry.youMight),
        othersProbably: safeArray(ancestry.othersProbably),
        popularEdicts: safeArray(ancestry.popularEdicts),
        popularAnathema: safeArray(ancestry.popularAnathema),
        sampleNames: ancestry.sampleNames ?? '',
        hp: typeof ancestry.hp === 'number' ? ancestry.hp : 0,
        speed: typeof ancestry.speed === 'number' ? ancestry.speed : 0,
        size: ancestry.size ?? '',
        abilityBoosts: safeArray(ancestry.abilityBoosts),
        abilityFlaw: ancestry.abilityFlaw ?? null,
        languages: safeArray(ancestry.languages),
        bonusLanguages: ancestry.bonusLanguages ?? '',
        languageRules: ancestryLanguageRules(ancestry, languages),
        senses: safeArray(ancestry.senses),
        specialAbilities: safeArray(ancestry.specialAbilities).map(ability => ({
          name: ability.name ?? 'Особая способность',
          description: ability.description ?? '',
        })),
        heritages: safeArray(ancestry.heritages).map((heritage, heritageIndex) => ({
          id: stableFeatureId(`${ancestryId}-heritage`, heritage, heritageIndex),
          name: heritage.name ?? 'Неизвестное наследие',
          description: heritage.description ?? heritage.desc ?? '',
          traits: safeArray((heritage as RawRuleFeature & { traits?: string[] }).traits),
          ancestryId,
          ancestryName,
        })),
        sourceBook: ancestry.sourceBook ?? '',
      }
    })

  const versatileHeritages: Pathfinder2VersatileHeritageRule[] = safeArray(
    ancestryDocument.versatileHeritages,
  ).map((heritage, index) => ({
    id: heritage.id ?? `versatile-heritage-${index + 1}`,
    name: heritage.name ?? 'Неизвестное наследие',
    altName: heritage.altName ?? '',
    tagline: heritage.tagline ?? '',
    description: heritage.description ?? '',
    traits: safeArray(heritage.traits),
    senses: safeArray(heritage.senses),
    mechanics: heritage.mechanics ?? '',
    sourceBook: heritage.sourceBook ?? '',
    negativeHealing: Boolean(heritage.negativeHealing),
  }))

  const backgrounds: Pathfinder2BackgroundRule[] = safeArray(
    backgroundDocument.backgrounds,
  ).map((background, index) => {
    const backgroundId = background.id ?? `background-${index + 1}`
    const backgroundName = background.name ?? 'Неизвестная предыстория'
    const abilityBoosts = getStructuredBackgroundAbilityText(
      background.abilityBoosts ?? background.description ?? '',
    )
    const trainedSkills = background.trainedSkills ?? ''
    const parsedLore = getStructuredBackgroundLore(trainedSkills)
    const trainedLore = background.trainedLore || parsedLore.name
    const skillFeat = canonicalFeatName(background.skillFeat ?? '', skillFeats)
    const skillFeatId = skillFeats.find(feat => feat.name === skillFeat)?.id
    const source: Pathfinder2CharacterSource = {
      type: 'background',
      id: backgroundId,
      label: `Предыстория · ${backgroundName}`,
      level: 1,
    }
    return {
      id: backgroundId,
      name: backgroundName,
      description: background.description ?? '',
      rarity: background.rarity ?? 'common',
      abilityBoosts,
      abilityBoostOptions: getStructuredBackgroundAbilityOptions(abilityBoosts),
      trainedSkills,
      skillRules: getStructuredBackgroundSkillRules(backgroundId, trainedSkills),
      trainedLore,
      skillFeat,
      grantedLore: trainedLore
        ? {
            id: `background:${backgroundId}:lore`,
            name: trainedLore,
            rank: 'trained',
            source,
            custom: background.trainedLore ? false : parsedLore.custom,
          }
        : null,
      grantedFeatIds: skillFeatId ? [skillFeatId] : [],
      sourceBook: background.sourceBook ?? '',
      tab: background.tab ?? 'general',
      region: background.region ?? null,
    }
  })

  const classes: Pathfinder2ClassRule[] = safeArray(classDocument.classes)
    .map((characterClass, index) => {
      const classId = characterClass.id ?? `class-${index + 1}`
      const className = characterClass.name ?? 'Неизвестный класс'
      const source: Pathfinder2CharacterSource = {
        type: 'class',
        id: classId,
        label: `Класс · ${className}`,
        level: 1,
      }
      const specializations = safeArray(characterClass.subclasses).map(
        (feature, featureIndex) => {
          const normalized = toFeature(
            `${classId}-subclass`,
            feature,
            featureIndex,
          )
          return {
            ...normalized,
            grantedSkills: getSpecializationGrantedSkills(classId, normalized.id),
          }
        },
      )
      const proficiencyGrants: Pathfinder2ProficiencyGrant[] = [
        {
          category: 'perception',
          rank: proficiencyRank(characterClass.perception),
          level: 1,
          source,
        },
        {
          category: 'fortitude',
          rank: proficiencyRank(characterClass.fortitude),
          level: 1,
          source,
        },
        {
          category: 'reflex',
          rank: proficiencyRank(characterClass.reflex),
          level: 1,
          source,
        },
        {
          category: 'will',
          rank: proficiencyRank(characterClass.will),
          level: 1,
          source,
        },
        {
          category: 'class-dc',
          rank: proficiencyRank(characterClass.classDC),
          level: 1,
          source,
        },
        ...equipmentProficiencyGrants(characterClass.attacks ?? '', 'weapon', source),
        ...equipmentProficiencyGrants(characterClass.defenses ?? '', 'armor', source),
      ]
      return {
        id: classId,
        name: className,
        description: characterClass.description ?? '',
        rarity: characterClass.rarity ?? 'common',
        role: characterClass.role ?? '',
        hp: typeof characterClass.hp === 'number' ? characterClass.hp : 0,
        keyAbilities: parseKeyAbilities(characterClass.keyAbility),
        perception: characterClass.perception ?? '',
        fortitude: characterClass.fortitude ?? '',
        reflex: characterClass.reflex ?? '',
        will: characterClass.will ?? '',
        skills: characterClass.skills ?? '',
        skillRules: getStructuredClassSkillRules(classId),
        attacks: characterClass.attacks ?? '',
        defenses: characterClass.defenses ?? '',
        classDc: characterClass.classDC ?? '',
        proficiencyGrants,
        choiceDefinitions: specializations.length > 0
          ? [{
              id: `class:${classId}:specialization`,
              classId,
              label: classChoiceLabel(classId),
              level: 1,
              required: true,
              count: 1,
              options: specializations.map(specialization => ({
                id: specialization.id,
                label: specialization.name,
                description: specialization.description,
                sourceId: specialization.id,
              })),
            }]
          : [],
        requiresDeity: classId === 'cleric' || classId === 'champion',
        spellTradition: characterClass.spellTradition ?? null,
        spellSlots: characterClass.spellSlots ?? null,
        keyTerms: safeArray(characterClass.keyTerms).map((feature, featureIndex) => (
          toFeature(`${classId}-term`, feature, featureIndex)
        )),
        roleplaying: normalizeRoleplaying(characterClass.roleplaying),
        features: safeArray(characterClass.features).map((feature, featureIndex) => (
          toFeature(`${classId}-feature`, feature, featureIndex)
        )),
        specializations,
        sourceBook: characterClass.sourceBook ?? '',
      }
    })

  return {
    ancestries,
    versatileHeritages,
    backgrounds,
    classes,
    generalFeats,
    skillFeats,
    mythicFeats,
    ancestryFeats,
    classFeats,
    classProgression,
    equipment: catalogEntries(equipmentCatalog) as Pathfinder2EquipmentItem[],
    weapons: catalogEntries(weaponsCatalog) as Pathfinder2WeaponRule[],
    armor: catalogEntries(armorCatalog) as Pathfinder2ArmorRule[],
    shields: catalogEntries(shieldsCatalog) as Pathfinder2ShieldRule[],
    spells,
    cantrips,
    focusSpells,
    languages,
    deities,
    traits,
    sources: [
      sourceFrom('ancestries', ancestryDocument),
      sourceFrom('backgrounds', backgroundDocument),
      sourceFrom('classes', classDocument),
      sourceFrom('feats', featDocument),
      {
        id: 'ancestry-feats' as const,
        title: ancestryFeatsCatalog.title as string,
        version: ancestryFeatsCatalog.version as string,
        source: ancestryFeatsCatalog.source as string,
      },
      {
        id: 'class-feats' as const,
        title: classFeatsCatalog.title as string,
        version: classFeatsCatalog.version as string,
        source: classFeatsCatalog.source as string,
      },
      {
        id: 'class-progression' as const,
        title: classProgressionCatalog.title as string,
        version: classProgressionCatalog.version as string,
        source: classProgressionCatalog.source as string,
      },
      {
        id: 'equipment' as const,
        title: equipmentCatalog.title as string,
        version: equipmentCatalog.version as string,
        source: equipmentCatalog.source as string,
      },
      {
        id: 'weapons' as const,
        title: weaponsCatalog.title as string,
        version: weaponsCatalog.version as string,
        source: weaponsCatalog.source as string,
      },
      {
        id: 'armor' as const,
        title: armorCatalog.title as string,
        version: armorCatalog.version as string,
        source: armorCatalog.source as string,
      },
      {
        id: 'shields' as const,
        title: shieldsCatalog.title as string,
        version: shieldsCatalog.version as string,
        source: shieldsCatalog.source as string,
      },
      sourceFrom('spells', spellDocument),
      {
        id: 'deities' as const,
        title: deitiesCatalog.title as string,
        version: deitiesCatalog.version as string,
        source: deitiesCatalog.source as string,
      },
      {
        id: 'languages' as const,
        title: languagesCatalog.title as string,
        version: languagesCatalog.version as string,
        source: languagesCatalog.source as string,
      },
      {
        id: 'traits' as const,
        title: traitsCatalog.title as string,
        version: traitsCatalog.version as string,
        source: traitsCatalog.source as string,
      },
    ],
    dataAvailability,
    validationWarnings: validateDocuments({
      ancestries: ancestryDocument.ancestries,
      versatileHeritages: ancestryDocument.versatileHeritages,
      backgrounds: backgroundDocument.backgrounds,
      classes: classDocument.classes,
      generalFeats: featDocument.feats?.general,
      skillFeats: featDocument.feats?.skill,
      classProgression,
    }),
  }
}
