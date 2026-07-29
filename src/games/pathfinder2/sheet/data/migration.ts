import { DEFAULT_PATHFINDER2_DRAFT } from '../data'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2UnresolvedSelections,
} from '../types'
import {
  getAncestryById,
  getAncestryHeritages,
  getBackgroundById,
  getClassById,
  getHeritageById,
  getSubclassById,
  getVersatileHeritageById,
} from './selectors'

type UnknownRecord = Record<string, unknown>

export type Pathfinder2MigrationResult = {
  draft: Pathfinder2CharacterDraft
  warnings: string[]
  migrated: boolean
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function clampLevel(value: unknown) {
  return Math.min(20, Math.max(1, Math.round(asNumber(value, 1) || 1)))
}

function normalizeFeatName(value: string) {
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function findFeatIdByName(
  value: string,
  feats: Pathfinder2RulesCatalog['generalFeats'],
) {
  const normalized = normalizeFeatName(value)
  return feats.find(feat => (
    feat.name === value || feat.name === normalized
  ))?.id
}

function migrateAttributes(value: unknown) {
  const raw = isRecord(value) ? value : {}
  return Object.fromEntries(
    Object.entries(DEFAULT_PATHFINDER2_DRAFT.attributes).map(([key, fallback]) => [
      key,
      Math.min(6, Math.max(-2, asNumber(raw[key], fallback))),
    ]),
  ) as Record<Pathfinder2AttributeKey, number>
}

function collectUnresolvedSelections(
  value: unknown,
  legacy: UnknownRecord,
): Pathfinder2UnresolvedSelections {
  const existing = isRecord(value) ? value : {}
  return {
    ...(asString(existing.heritageName)
      ? { heritageName: asString(existing.heritageName) }
      : {}),
    ...(asString(existing.subclassName)
      ? { subclassName: asString(existing.subclassName) }
      : {}),
    ...(asString(existing.classFeatName)
      ? { classFeatName: asString(existing.classFeatName) }
      : {}),
    ...(asString(existing.skillFeatName)
      ? { skillFeatName: asString(existing.skillFeatName) }
      : {}),
    ...(asString(existing.generalFeatName)
      ? { generalFeatName: asString(existing.generalFeatName) }
      : {}),
    ...(asString(legacy.heritage) ? { heritageName: asString(legacy.heritage) } : {}),
    ...(asString(legacy.specialization)
      ? { subclassName: asString(legacy.specialization) }
      : {}),
    ...(asString(legacy.classFeat)
      ? { classFeatName: asString(legacy.classFeat) }
      : {}),
    ...(asString(legacy.skillFeat)
      ? { skillFeatName: asString(legacy.skillFeat) }
      : {}),
    ...(asString(legacy.generalFeat)
      ? { generalFeatName: asString(legacy.generalFeat) }
      : {}),
  }
}

export function migratePathfinder2Draft(
  value: unknown,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2MigrationResult {
  const raw = isRecord(value) ? value : {}
  const warnings: string[] = []
  const unresolved = collectUnresolvedSelections(raw.unresolvedSelections, raw)
  const ancestryId = asString(raw.ancestryId)
  const classId = asString(raw.classId)

  let heritageId = asString(raw.heritageId)
  let versatileHeritageId = asString(raw.versatileHeritageId)
  const legacyHeritageName = asString(raw.heritage)
    || asString((isRecord(raw.unresolvedSelections) ? raw.unresolvedSelections : {}).heritageName)

  if (!heritageId && !versatileHeritageId && legacyHeritageName) {
    const ancestryHeritage = getAncestryHeritages(catalog, ancestryId)
      .find(heritage => heritage.name === legacyHeritageName)
    const versatileHeritage = catalog.versatileHeritages
      .find(heritage => heritage.name === legacyHeritageName || heritage.altName === legacyHeritageName)
    if (ancestryHeritage) {
      heritageId = ancestryHeritage.id
      delete unresolved.heritageName
    } else if (versatileHeritage) {
      versatileHeritageId = versatileHeritage.id
      delete unresolved.heritageName
    } else {
      warnings.push(`Наследие «${legacyHeritageName}» больше не найдено в справочнике.`)
    }
  }

  let subclassId = asString(raw.subclassId)
  const legacySubclassName = asString(raw.specialization)
    || asString((isRecord(raw.unresolvedSelections) ? raw.unresolvedSelections : {}).subclassName)
  if (!subclassId && legacySubclassName) {
    const matchedSubclass = getClassById(catalog, classId)?.specializations
      .find(subclass => subclass.name === legacySubclassName)
    if (matchedSubclass) {
      subclassId = matchedSubclass.id
      delete unresolved.subclassName
    } else {
      warnings.push(`Специализация «${legacySubclassName}» не найдена в выбранном классе.`)
    }
  }

  const legacyClassFeatName = asString(raw.classFeat)
  const migratedClassFeatId = legacyClassFeatName
    ? getClassById(catalog, classId)?.features.find(
      feature => feature.name === legacyClassFeatName,
    )?.id
    : undefined
  const legacySkillFeatName = asString(raw.skillFeat)
  const migratedSkillFeatId = findFeatIdByName(legacySkillFeatName, catalog.skillFeats)
  const legacyGeneralFeatName = asString(raw.generalFeat)
  const migratedGeneralFeatId = findFeatIdByName(legacyGeneralFeatName, catalog.generalFeats)

  if (migratedClassFeatId) delete unresolved.classFeatName
  if (migratedSkillFeatId) delete unresolved.skillFeatName
  if (migratedGeneralFeatId) delete unresolved.generalFeatName

  const keyAbility = asString(raw.keyAbility)
  const validKeyAbility: Pathfinder2AttributeKey | '' = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ].includes(keyAbility)
    ? keyAbility as Pathfinder2AttributeKey
    : ''

  const draft: Pathfinder2CharacterDraft = {
    schemaVersion: 2,
    name: asString(raw.name),
    player: asString(raw.player),
    pronouns: asString(raw.pronouns),
    concept: asString(raw.concept),
    level: clampLevel(raw.level),
    portrait: asString(raw.portrait),
    ancestryId,
    heritageId,
    versatileHeritageId,
    backgroundId: asString(raw.backgroundId),
    classId,
    subclassId,
    keyAbility: validKeyAbility,
    attributes: migrateAttributes(raw.attributes),
    trainedSkills: asStringArray(raw.trainedSkills),
    lore: asString(raw.lore),
    ancestryFeatIds: asStringArray(raw.ancestryFeatIds),
    classFeatIds: Array.from(new Set([
      ...asStringArray(raw.classFeatIds),
      ...(migratedClassFeatId ? [migratedClassFeatId] : []),
    ])),
    skillFeatIds: Array.from(new Set([
      ...asStringArray(raw.skillFeatIds),
      ...(migratedSkillFeatId ? [migratedSkillFeatId] : []),
    ])),
    generalFeatIds: Array.from(new Set([
      ...asStringArray(raw.generalFeatIds),
      ...(migratedGeneralFeatId ? [migratedGeneralFeatId] : []),
    ])),
    languages: asString(raw.languages),
    equipment: asString(raw.equipment),
    notes: asString(raw.notes),
    currentHp: Math.max(0, Math.round(asNumber(raw.currentHp, 0))),
    tempHp: Math.max(0, Math.round(asNumber(raw.tempHp, 0))),
    unresolvedSelections: unresolved,
  }

  if (draft.ancestryId && !getAncestryById(catalog, draft.ancestryId)) {
    warnings.push('Выбранный народ больше не найден в справочнике.')
  }
  if (
    draft.heritageId
    && !getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  ) {
    warnings.push('Выбранное обычное наследие не подходит текущему народу.')
  }
  if (
    draft.versatileHeritageId
    && !getVersatileHeritageById(catalog, draft.versatileHeritageId)
  ) {
    warnings.push('Выбранное универсальное наследие больше не найдено.')
  }
  if (draft.backgroundId && !getBackgroundById(catalog, draft.backgroundId)) {
    warnings.push('Выбранная предыстория больше не найдена в справочнике.')
  }
  if (draft.classId && !getClassById(catalog, draft.classId)) {
    warnings.push('Выбранный класс больше не найден в справочнике.')
  }
  if (draft.subclassId && !getSubclassById(catalog, draft.classId, draft.subclassId)) {
    warnings.push('Выбранная специализация больше не найдена в выбранном классе.')
  }

  return {
    draft,
    warnings: Array.from(new Set(warnings)),
    migrated: raw.schemaVersion !== 2 || [
      'heritage',
      'specialization',
      'classFeat',
      'skillFeat',
      'generalFeat',
    ].some(field => field in raw),
  }
}

export function parseAndMigratePathfinder2Draft(
  raw: string,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2MigrationResult | null {
  try {
    return migratePathfinder2Draft(JSON.parse(raw) as unknown, catalog)
  } catch {
    return null
  }
}
