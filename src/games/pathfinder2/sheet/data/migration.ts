import {
  createDefaultPathfinder2Draft,
  PATHFINDER2_ATTRIBUTES,
  PATHFINDER2_SKILLS,
} from '../data'
import type {
  Pathfinder2AttributeChoices,
  Pathfinder2AttributeKey,
  Pathfinder2Attributes,
  Pathfinder2CharacterDraft,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillChoices,
  Pathfinder2SkillId,
  Pathfinder2SkillIncrease,
  Pathfinder2UnresolvedSelections,
} from '../types'
import {
  getAncestryById,
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

const ATTRIBUTE_KEYS = new Set(PATHFINDER2_ATTRIBUTES.map(attribute => attribute.key))
const SKILL_IDS = new Set(PATHFINDER2_SKILLS.map(skill => skill.id))
const SKILL_ID_BY_NAME = new Map(PATHFINDER2_SKILLS.map(skill => [skill.label, skill.id]))
const PROFICIENCY_RANKS = new Set<Pathfinder2ProficiencyRank>([
  'untrained',
  'trained',
  'expert',
  'master',
  'legendary',
])

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function clampLevel(value: unknown) {
  return Math.min(20, Math.max(1, Math.round(asNumber(value, 1) || 1)))
}

function asAttributeKey(value: unknown): Pathfinder2AttributeKey | null {
  return typeof value === 'string' && ATTRIBUTE_KEYS.has(value as Pathfinder2AttributeKey)
    ? value as Pathfinder2AttributeKey
    : null
}

function asAttributeKeys(value: unknown) {
  return Array.isArray(value)
    ? value.map(asAttributeKey).filter((key): key is Pathfinder2AttributeKey => Boolean(key))
    : []
}

function asSkillId(value: unknown): Pathfinder2SkillId | null {
  if (typeof value !== 'string') return null
  if (SKILL_IDS.has(value as Pathfinder2SkillId)) return value as Pathfinder2SkillId
  return SKILL_ID_BY_NAME.get(value) ?? null
}

function asSkillIds(value: unknown) {
  return Array.isArray(value)
    ? value.map(asSkillId).filter((id): id is Pathfinder2SkillId => Boolean(id))
    : []
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

function migrateLegacyAttributes(value: unknown): Pathfinder2Attributes | undefined {
  if (!isRecord(value)) return undefined
  return Object.fromEntries(PATHFINDER2_ATTRIBUTES.map(({ key }) => [
    key,
    asNumber(value[key], 0),
  ])) as Pathfinder2Attributes
}

function migrateAttributeChoices(
  value: unknown,
  legacyKeyAbility: unknown,
): Pathfinder2AttributeChoices {
  const raw = isRecord(value) ? value : {}
  const levelBoosts = isRecord(raw.levelBoosts) ? raw.levelBoosts : {}
  return {
    ancestryMode: raw.ancestryMode === 'alternate' ? 'alternate' : 'standard',
    ancestryFreeBoosts: asAttributeKeys(raw.ancestryFreeBoosts),
    voluntaryFlaws: asAttributeKeys(raw.voluntaryFlaws),
    backgroundLimitedBoost: asAttributeKey(raw.backgroundLimitedBoost),
    backgroundFreeBoost: asAttributeKey(raw.backgroundFreeBoost),
    classKeyBoost: asAttributeKey(raw.classKeyBoost) ?? asAttributeKey(legacyKeyAbility),
    finalFreeBoosts: asAttributeKeys(raw.finalFreeBoosts),
    levelBoosts: {
      5: asAttributeKeys(levelBoosts[5]),
      10: asAttributeKeys(levelBoosts[10]),
      15: asAttributeKeys(levelBoosts[15]),
      20: asAttributeKeys(levelBoosts[20]),
    },
  }
}

function migrateSkillIncreases(value: unknown): Pathfinder2SkillIncrease[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!isRecord(item)) return []
    const skillId = asSkillId(item.skillId)
    const fromRank = asString(item.fromRank) as Pathfinder2ProficiencyRank
    const toRank = asString(item.toRank) as Pathfinder2ProficiencyRank
    if (
      !skillId
      || !PROFICIENCY_RANKS.has(fromRank)
      || !PROFICIENCY_RANKS.has(toRank)
    ) return []
    return [{
      level: clampLevel(item.level),
      skillId,
      fromRank,
      toRank,
    }]
  })
}

function migrateSkillChoices(
  value: unknown,
  legacyTrainedSkills: unknown,
): Pathfinder2SkillChoices {
  const raw = isRecord(value) ? value : {}
  const grantedRaw = isRecord(raw.grantedChoiceSelections)
    ? raw.grantedChoiceSelections
    : {}
  const replacementRaw = isRecord(raw.replacementSkills)
    ? raw.replacementSkills
    : {}
  const grantedChoiceSelections = Object.fromEntries(
    Object.entries(grantedRaw).map(([id, values]) => [id, asSkillIds(values)]),
  )
  const replacementSkills = Object.fromEntries(
    Object.entries(replacementRaw).flatMap(([id, value]) => {
      const skillId = asSkillId(value)
      return skillId ? [[id, skillId]] : []
    }),
  )
  return {
    grantedChoiceSelections,
    classFreeSkills: asSkillIds(raw.classFreeSkills),
    intelligenceSkills: asSkillIds(raw.intelligenceSkills),
    replacementSkills,
    skillIncreases: migrateSkillIncreases(raw.skillIncreases),
    suggestedSkills: Array.from(new Set([
      ...asSkillIds(raw.suggestedSkills),
      ...asSkillIds(legacyTrainedSkills),
    ])),
  }
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
  const legacySchema = raw.schemaVersion !== 3

  let heritageId = asString(raw.heritageId)
  let versatileHeritageId = asString(raw.versatileHeritageId)
  const legacyHeritageName = asString(raw.heritage)
    || asString((isRecord(raw.unresolvedSelections) ? raw.unresolvedSelections : {}).heritageName)

  if (!heritageId && !versatileHeritageId && legacyHeritageName) {
    const ancestryHeritage = catalog.ancestries
      .find(ancestry => ancestry.id === ancestryId)?.heritages
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
  if (heritageId && versatileHeritageId) {
    versatileHeritageId = ''
    warnings.push('Старый черновик содержал два наследия. Сохранено обычное; универсальное нужно подтвердить заново.')
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
  const migratedSkillFeatId = findFeatIdByName(asString(raw.skillFeat), catalog.skillFeats)
  const migratedGeneralFeatId = findFeatIdByName(asString(raw.generalFeat), catalog.generalFeats)
  if (migratedClassFeatId) delete unresolved.classFeatName
  if (migratedSkillFeatId) delete unresolved.skillFeatName
  if (migratedGeneralFeatId) delete unresolved.generalFeatName

  const existingLegacy = isRecord(raw.legacySnapshot) ? raw.legacySnapshot : {}
  const legacyAttributes = migrateLegacyAttributes(existingLegacy.attributes)
    ?? migrateLegacyAttributes(raw.attributes)
  const legacySkills = asStringArray(existingLegacy.trainedSkills).length
    ? asStringArray(existingLegacy.trainedSkills)
    : asStringArray(raw.trainedSkills)
  const hasLegacySnapshot = Boolean(legacyAttributes || legacySkills.length)

  const draft: Pathfinder2CharacterDraft = {
    ...createDefaultPathfinder2Draft(),
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
    attributeChoices: migrateAttributeChoices(raw.attributeChoices, raw.keyAbility),
    skillChoices: migrateSkillChoices(raw.skillChoices, raw.trainedSkills),
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
    needsRulesRebuild: legacySchema
      ? true
      : asBoolean(raw.needsRulesRebuild),
    legacySnapshot: hasLegacySnapshot
      ? {
        ...(legacyAttributes ? { attributes: legacyAttributes } : {}),
        ...(legacySkills.length ? { trainedSkills: legacySkills } : {}),
      }
      : null,
    unresolvedSelections: unresolved,
  }

  if (legacySchema) {
    warnings.push('Черновик создан до появления автоматической проверки правил. Подтвердите распределение характеристик и навыков.')
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
    migrated: legacySchema || [
      'heritage',
      'specialization',
      'classFeat',
      'skillFeat',
      'generalFeat',
      'attributes',
      'trainedSkills',
      'keyAbility',
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
