import 'server-only'

import ancestriesRules from '../Rules/ancestries.json'
import backgroundsRules from '../Rules/backgrounds.json'
import classesRules from '../Rules/classes.json'
import featsRules from '../Rules/feats.json'
import {
  getSpecializationGrantedSkills,
  getStructuredBackgroundAbilityOptions,
  getStructuredBackgroundSkillRules,
  getStructuredClassSkillRules,
} from './rules/creation/structured-rules'
import type {
  Pathfinder2AncestryRule,
  Pathfinder2AttributeKey,
  Pathfinder2BackgroundRule,
  Pathfinder2ClassRoleplayingRule,
  Pathfinder2ClassRule,
  Pathfinder2FeatRule,
  Pathfinder2RuleFeature,
  Pathfinder2RuleSource,
  Pathfinder2RulesCatalog,
  Pathfinder2SpecialAbilityRule,
  Pathfinder2VersatileHeritageRule,
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
  level?: number
  description?: string
  prerequisites?: string | null
  traits?: string[]
  skill?: string
  sourceBook?: string
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
  return {
    id: feat.id ?? `${group}-${index + 1}`,
    name: feat.name ?? 'Без названия',
    level: typeof feat.level === 'number' ? feat.level : 1,
    description: feat.description ?? '',
    prerequisites: feat.prerequisites ?? null,
    traits: safeArray(feat.traits),
    ...(feat.skill ? { skill: feat.skill } : {}),
    ...(feat.sourceBook ? { sourceBook: feat.sourceBook } : {}),
  }
}

function parseKeyAbilities(value = ''): Pathfinder2AttributeKey[] {
  const normalized = value.toLowerCase()
  return ATTRIBUTE_KEYS.filter(key => normalized.includes(key))
}

function canonicalFeatName(value: string, feats: Pathfinder2FeatRule[]) {
  const withoutEnglishName = value.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return feats.find(feat => feat.name === value || feat.name === withoutEnglishName)?.name
    ?? withoutEnglishName
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
}): string[] {
  const warnings: string[] = []
  for (const [label, value] of Object.entries(documents)) {
    if (!Array.isArray(value)) warnings.push(`Справочник «${label}» имеет неизвестный формат.`)
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

  const rawGeneralFeats = safeArray(featDocument.feats?.general)
  const rawSkillFeats = safeArray(featDocument.feats?.skill)
  const rawMythicFeats = safeArray(featDocument.feats?.mythic)
  const generalFeats = rawGeneralFeats.map((feat, index) => toFeat(feat, index, 'general'))
  const skillFeats = rawSkillFeats.map((feat, index) => toFeat(feat, index, 'skill'))
  const mythicFeats = rawMythicFeats.map((feat, index) => toFeat(feat, index, 'mythic'))

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
    const abilityBoosts = background.abilityBoosts ?? ''
    const trainedSkills = background.trainedSkills ?? ''
    return {
      id: backgroundId,
      name: background.name ?? 'Неизвестная предыстория',
      description: background.description ?? '',
      rarity: background.rarity ?? 'common',
      abilityBoosts,
      abilityBoostOptions: getStructuredBackgroundAbilityOptions(abilityBoosts),
      trainedSkills,
      skillRules: getStructuredBackgroundSkillRules(backgroundId, trainedSkills),
      trainedLore: background.trainedLore ?? '',
      skillFeat: canonicalFeatName(background.skillFeat ?? '', skillFeats),
      sourceBook: background.sourceBook ?? '',
      tab: background.tab ?? 'general',
      region: background.region ?? null,
    }
  })

  const classes: Pathfinder2ClassRule[] = safeArray(classDocument.classes)
    .map((characterClass, index) => {
      const classId = characterClass.id ?? `class-${index + 1}`
      return {
        id: classId,
        name: characterClass.name ?? 'Неизвестный класс',
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
        spellTradition: characterClass.spellTradition ?? null,
        spellSlots: characterClass.spellSlots ?? null,
        keyTerms: safeArray(characterClass.keyTerms).map((feature, featureIndex) => (
          toFeature(`${classId}-term`, feature, featureIndex)
        )),
        roleplaying: normalizeRoleplaying(characterClass.roleplaying),
        features: safeArray(characterClass.features).map((feature, featureIndex) => (
          toFeature(`${classId}-feature`, feature, featureIndex)
        )),
        specializations: safeArray(characterClass.subclasses).map(
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
        ),
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
    sources: [
      sourceFrom('ancestries', ancestryDocument),
      sourceFrom('backgrounds', backgroundDocument),
      sourceFrom('classes', classDocument),
      sourceFrom('feats', featDocument),
    ],
    validationWarnings: validateDocuments({
      ancestries: ancestryDocument.ancestries,
      versatileHeritages: ancestryDocument.versatileHeritages,
      backgrounds: backgroundDocument.backgrounds,
      classes: classDocument.classes,
      generalFeats: featDocument.feats?.general,
      skillFeats: featDocument.feats?.skill,
    }),
  }
}
