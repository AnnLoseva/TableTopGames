import {
  createDefaultPathfinder2Draft,
  PATHFINDER2_ATTRIBUTES,
  PATHFINDER2_SKILLS,
} from '../data'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterSource,
  Pathfinder2FeatSlotType,
  Pathfinder2LevelChoices,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillId,
  Pathfinder2SkillIncrease,
  Pathfinder2UnresolvedSelection,
  Pathfinder2UnresolvedSelections,
} from '../types'
import {
  migratePathfinder2Draft,
} from './migration'
import { createDefaultPathfinder2DraftV4 } from './v4'

type UnknownRecord = Record<string, unknown>

export type Pathfinder2MigrationV4Result = {
  draft: Pathfinder2CharacterDraftV4
  runtimeDraft: Pathfinder2CharacterDraft
  warnings: string[]
  migrated: boolean
}

const ATTRIBUTE_KEYS = new Set(PATHFINDER2_ATTRIBUTES.map(attribute => attribute.key))
const SKILL_IDS = new Set(PATHFINDER2_SKILLS.map(skill => skill.id))
const PROFICIENCY_RANKS = new Set<Pathfinder2ProficiencyRank>([
  'untrained',
  'trained',
  'expert',
  'master',
  'legendary',
])
const FEAT_SLOT_TYPES: Pathfinder2FeatSlotType[] = [
  'ancestry-feat',
  'class-feat',
  'skill-feat',
  'general-feat',
  'archetype-feat',
  'bonus-feat',
  'mythic-feat',
]

const MIGRATION_SOURCE: Pathfinder2CharacterSource = {
  type: 'migration',
  id: 'pathfinder2-v3',
  label: 'Импорт черновика schema v3',
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown) {
  const normalized = asString(value)
  return normalized || null
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asInteger(value: unknown, fallback = 0) {
  return Math.round(asNumber(value, fallback))
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function asUniqueStrings(value: unknown) {
  return Array.from(new Set(asStringArray(value)))
}

function asAttributeKey(value: unknown): Pathfinder2AttributeKey | null {
  return typeof value === 'string' && ATTRIBUTE_KEYS.has(value as Pathfinder2AttributeKey)
    ? value as Pathfinder2AttributeKey
    : null
}

function asAttributeKeys(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value
      .map(asAttributeKey)
      .filter((key): key is Pathfinder2AttributeKey => Boolean(key))))
    : []
}

function asSkillId(value: unknown): Pathfinder2SkillId | null {
  return typeof value === 'string' && SKILL_IDS.has(value as Pathfinder2SkillId)
    ? value as Pathfinder2SkillId
    : null
}

function asSkillIds(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value
      .map(asSkillId)
      .filter((id): id is Pathfinder2SkillId => Boolean(id))))
    : []
}

function asStringArrayRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, entries]) => [
      key,
      asUniqueStrings(entries),
    ]),
  )
}

function asSkillArrayRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, entries]) => [
      key,
      asSkillIds(entries),
    ]),
  )
}

function asAttributeArrayRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, entries]) => [
      Number(key),
      asAttributeKeys(entries),
    ]),
  )
}

function asStringRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).flatMap(([key, entry]) => {
      const normalized = asString(entry)
      return normalized ? [[key, normalized]] : []
    }),
  )
}

function clampLevel(value: unknown) {
  return Math.min(20, Math.max(1, asInteger(value, 1) || 1))
}

function asSkillIncrease(value: unknown): Pathfinder2SkillIncrease | null {
  const entry = asRecord(value)
  const skillId = asSkillId(entry.skillId)
  const fromRank = asString(entry.fromRank) as Pathfinder2ProficiencyRank
  const toRank = asString(entry.toRank) as Pathfinder2ProficiencyRank
  if (
    !skillId
    || !PROFICIENCY_RANKS.has(fromRank)
    || !PROFICIENCY_RANKS.has(toRank)
  ) return null
  return {
    level: clampLevel(entry.level),
    skillId,
    fromRank,
    toRank,
  }
}

function asSkillIncreaseArray(value: unknown) {
  return Array.isArray(value)
    ? value
      .map(asSkillIncrease)
      .filter((entry): entry is Pathfinder2SkillIncrease => Boolean(entry))
    : []
}

function emptyLevelChoices(level: number): Pathfinder2LevelChoices {
  return {
    level,
    attributeBoosts: [],
    skillIncreases: [],
    featSelections: {},
    classFeatureChoices: {},
    learnedSpellIds: [],
    removedSpellIds: [],
    languageChoices: [],
  }
}

function asLevelChoicesRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).flatMap(([key, rawChoice]) => {
      const level = clampLevel(Number(key))
      if (!Number.isFinite(Number(key))) return []
      const choice = asRecord(rawChoice)
      return [[level, {
        level,
        attributeBoosts: asAttributeKeys(choice.attributeBoosts),
        skillIncreases: asSkillIncreaseArray(choice.skillIncreases),
        featSelections: asStringRecord(choice.featSelections),
        classFeatureChoices: asStringArrayRecord(choice.classFeatureChoices),
        learnedSpellIds: asUniqueStrings(choice.learnedSpellIds),
        removedSpellIds: asUniqueStrings(choice.removedSpellIds),
        languageChoices: asUniqueStrings(choice.languageChoices),
      } satisfies Pathfinder2LevelChoices]]
    }),
  )
}

function normalizeUnresolvedSelections(value: unknown): Pathfinder2UnresolvedSelection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw, index) => {
    const entry = asRecord(raw)
    const kind = asString(entry.kind) as Pathfinder2UnresolvedSelection['kind']
    const allowedKinds: Pathfinder2UnresolvedSelection['kind'][] = [
      'heritage',
      'class-specialization',
      'ancestry-feat',
      'class-feat',
      'skill-feat',
      'general-feat',
      'language',
      'equipment',
      'lore',
      'custom',
    ]
    if (!allowedKinds.includes(kind)) return []
    const source = asRecord(entry.source)
    return [{
      id: asString(entry.id) || `migration-unresolved-${index}`,
      kind,
      value: asString(entry.value),
      ...(asString(entry.suggestedId)
        ? { suggestedId: asString(entry.suggestedId) }
        : {}),
      message: asString(entry.message) || 'Импортированное решение требует проверки.',
      source: {
        type: source.type === 'migration' ? 'migration' : 'custom',
        id: asString(source.id) || 'unknown',
        label: asString(source.label) || 'Импорт',
        ...(typeof source.level === 'number'
          ? { level: clampLevel(source.level) }
          : {}),
      },
    }]
  })
}

function normalizeV4(value: unknown): Pathfinder2CharacterDraftV4 {
  const base = createDefaultPathfinder2DraftV4()
  const raw = asRecord(value)
  const identity = asRecord(raw.identity)
  const progression = asRecord(raw.progression)
  const ancestry = asRecord(raw.ancestry)
  const background = asRecord(raw.background)
  const characterClass = asRecord(raw.class)
  const attributes = asRecord(raw.attributes)
  const skills = asRecord(raw.skills)
  const feats = asRecord(raw.feats)
  const suggestions = asRecord(feats.suggestedSelectionsByType)
  const spellcasting = asRecord(raw.spellcasting)
  const inventory = asRecord(raw.inventory)
  const currency = asRecord(inventory.currency)
  const details = asRecord(raw.details)
  const vitals = asRecord(raw.vitals)
  const migration = asRecord(raw.migration)
  const legacyNotes = asRecord(migration.legacyNotes)
  const level = clampLevel(progression.level)

  const increasesByLevel = Object.fromEntries(
    Object.entries(asRecord(skills.increasesByLevel)).map(([key, entries]) => [
      Number(key),
      asSkillIncreaseArray(entries),
    ]),
  )

  return {
    schemaVersion: 4,
    identity: {
      name: asString(identity.name),
      player: asString(identity.player),
      portrait: asString(identity.portrait),
      concept: asString(identity.concept),
      backstory: asString(identity.backstory),
      age: asString(identity.age),
      gender: asString(identity.gender),
      pronouns: asString(identity.pronouns),
      regionId: asNullableString(identity.regionId),
      partyRole: asString(identity.partyRole),
      connections: asString(identity.connections),
      preliminaryFaith: asString(identity.preliminaryFaith),
    },
    progression: {
      level,
      targetLevel: Math.max(level, clampLevel(progression.targetLevel)),
      creationMode: progression.creationMode === 'high-level'
        ? 'high-level'
        : 'level-1',
      experience: Math.max(0, asInteger(progression.experience)),
      heroPoints: Math.max(0, asInteger(progression.heroPoints, 1)),
      completedLevels: Array.from(new Set(
        (Array.isArray(progression.completedLevels)
          ? progression.completedLevels
          : [])
          .map(clampLevel)
          .filter(completedLevel => completedLevel <= level),
      )).sort((left, right) => left - right),
      choicesByLevel: asLevelChoicesRecord(progression.choicesByLevel),
    },
    ancestry: {
      ancestryId: asString(ancestry.ancestryId),
      heritageId: asNullableString(ancestry.heritageId),
      versatileHeritageId: asNullableString(ancestry.versatileHeritageId),
      boostMode: ancestry.boostMode === 'alternate' ? 'alternate' : 'standard',
      freeBoosts: asAttributeKeys(ancestry.freeBoosts),
      voluntaryFlaws: asAttributeKeys(ancestry.voluntaryFlaws),
      featChoicesByLevel: asStringArrayRecord(ancestry.featChoicesByLevel),
    },
    background: {
      backgroundId: asString(background.backgroundId),
      limitedBoost: asAttributeKey(background.limitedBoost),
      freeBoost: asAttributeKey(background.freeBoost),
    },
    class: {
      classId: asString(characterClass.classId),
      keyAbility: asAttributeKey(characterClass.keyAbility),
      specializationChoices: asStringArrayRecord(
        characterClass.specializationChoices,
      ),
      featChoicesByLevel: asStringArrayRecord(characterClass.featChoicesByLevel),
    },
    attributes: {
      priorities: asAttributeKeys(attributes.priorities),
      finalFreeBoosts: asAttributeKeys(attributes.finalFreeBoosts),
      levelBoosts: asAttributeArrayRecord(attributes.levelBoosts),
    },
    skills: {
      grantedChoiceSelections: asSkillArrayRecord(skills.grantedChoiceSelections),
      freeSelections: asSkillArrayRecord(skills.freeSelections),
      replacementSelections: Object.fromEntries(
        Object.entries(asRecord(skills.replacementSelections)).flatMap(([key, entry]) => {
          const skillId = asSkillId(entry)
          return skillId ? [[key, skillId]] : []
        }),
      ),
      increasesByLevel,
      loreEntries: Array.isArray(skills.loreEntries)
        ? skills.loreEntries.filter(isRecord) as Pathfinder2CharacterDraftV4['skills']['loreEntries']
        : [],
      suggestedSkills: asSkillIds(skills.suggestedSkills),
    },
    feats: {
      selectedBySlot: asStringRecord(feats.selectedBySlot),
      suggestedSelectionsByType: Object.fromEntries(
        FEAT_SLOT_TYPES.map(type => [type, asUniqueStrings(suggestions[type])]),
      ) as Pathfinder2CharacterDraftV4['feats']['suggestedSelectionsByType'],
    },
    spellcasting: {
      entries: Array.isArray(spellcasting.entries)
        ? spellcasting.entries.filter(isRecord) as Pathfinder2CharacterDraftV4['spellcasting']['entries']
        : [],
    },
    inventory: {
      entries: Array.isArray(inventory.entries)
        ? inventory.entries.filter(isRecord) as Pathfinder2CharacterDraftV4['inventory']['entries']
        : [],
      currency: {
        cp: Math.max(0, asInteger(currency.cp)),
        sp: Math.max(0, asInteger(currency.sp)),
        gp: Math.max(0, asInteger(currency.gp, base.inventory.currency.gp)),
        pp: Math.max(0, asInteger(currency.pp)),
      },
    },
    details: {
      deityId: asNullableString(details.deityId),
      religionText: asString(details.religionText),
      sanctification: details.sanctification === 'holy'
        || details.sanctification === 'unholy'
        ? details.sanctification
        : 'none',
      personalEdicts: asUniqueStrings(details.personalEdicts),
      personalAnathema: asUniqueStrings(details.personalAnathema),
      languageChoices: asUniqueStrings(details.languageChoices),
      customLanguages: asUniqueStrings(details.customLanguages),
      notes: asString(details.notes),
    },
    vitals: {
      currentHp: Math.max(0, asInteger(vitals.currentHp)),
      tempHp: Math.max(0, asInteger(vitals.tempHp)),
    },
    migration: {
      needsReview: asBoolean(migration.needsReview),
      unresolvedSelections: normalizeUnresolvedSelections(
        migration.unresolvedSelections,
      ),
      legacyNotes: {
        lore: asString(legacyNotes.lore),
        languages: asString(legacyNotes.languages),
        equipment: asString(legacyNotes.equipment),
      },
      legacySnapshot: migration.legacySnapshot ?? null,
    },
  }
}

function groupSkillIncreases(increases: Pathfinder2SkillIncrease[]) {
  return increases.reduce<Record<number, Pathfinder2SkillIncrease[]>>(
    (grouped, increase) => {
      grouped[increase.level] = [...(grouped[increase.level] ?? []), increase]
      return grouped
    },
    {},
  )
}

function buildChoicesByLevel(
  draft: Pathfinder2CharacterDraft,
  previous: Pathfinder2CharacterDraftV4 | undefined,
) {
  const choices: Record<number, Pathfinder2LevelChoices> = {
    ...(previous?.progression.choicesByLevel ?? {}),
  }
  const skillIncreases = groupSkillIncreases(draft.skillChoices.skillIncreases)
  const levels = new Set([
    ...Object.keys(choices).map(Number),
    ...Object.keys(skillIncreases).map(Number),
    5,
    10,
    15,
    20,
  ])
  levels.forEach(level => {
    const previousChoice = choices[level] ?? emptyLevelChoices(level)
    const attributeBoosts = level === 5 || level === 10 || level === 15 || level === 20
      ? draft.attributeChoices.levelBoosts[level]
      : previousChoice.attributeBoosts
    const next = {
      ...previousChoice,
      level,
      attributeBoosts: [...attributeBoosts],
      skillIncreases: [...(skillIncreases[level] ?? [])],
    }
    const hasChoices = next.attributeBoosts.length
      || next.skillIncreases.length
      || Object.keys(next.featSelections).length
      || Object.keys(next.classFeatureChoices).length
      || next.learnedSpellIds.length
      || next.removedSpellIds.length
      || next.languageChoices.length
    if (hasChoices) choices[level] = next
    else delete choices[level]
  })
  return choices
}

function runtimeUnresolvedSelections(
  value: Pathfinder2UnresolvedSelections,
): Pathfinder2UnresolvedSelection[] {
  const definitions: Array<{
    key: keyof Pathfinder2UnresolvedSelections
    kind: Pathfinder2UnresolvedSelection['kind']
  }> = [
    { key: 'heritageName', kind: 'heritage' },
    { key: 'subclassName', kind: 'class-specialization' },
    { key: 'classFeatName', kind: 'class-feat' },
    { key: 'skillFeatName', kind: 'skill-feat' },
    { key: 'generalFeatName', kind: 'general-feat' },
  ]
  return definitions.flatMap(({ key, kind }) => {
    const unresolvedValue = value[key]
    return unresolvedValue ? [{
      id: `migration:${kind}:${unresolvedValue}`,
      kind,
      value: unresolvedValue,
      message: 'Импортированное название не удалось надёжно связать со справочником.',
      source: MIGRATION_SOURCE,
    }] : []
  })
}

function mergeUnresolvedSelections(
  ...groups: Pathfinder2UnresolvedSelection[][]
) {
  return Array.from(new Map(
    groups.flat().map(entry => [entry.id, entry]),
  ).values())
}

function sameStringSet(left: string[], right: string[]) {
  return left.length === right.length
    && left.every(value => right.includes(value))
}

function updateLevelOneChoices(
  existing: Record<number, string[]>,
  runtimeIds: string[],
) {
  return sameStringSet(flattenRecordValues(existing), runtimeIds)
    ? existing
    : { ...existing, 1: [...runtimeIds] }
}

export function runtimeDraftToV4(
  draft: Pathfinder2CharacterDraft,
  previous?: Pathfinder2CharacterDraftV4,
): Pathfinder2CharacterDraftV4 {
  const base = previous ?? createDefaultPathfinder2DraftV4()
  const featSuggestions = {
    ...base.feats.suggestedSelectionsByType,
    'ancestry-feat': [...draft.ancestryFeatIds],
    'class-feat': [...draft.classFeatIds],
    'skill-feat': [...draft.skillFeatIds],
    'general-feat': draft.generalFeatIds.filter(id => (
      !base.feats.suggestedSelectionsByType['mythic-feat'].includes(id)
    )),
  }
  const runtimeUnresolved = runtimeUnresolvedSelections(draft.unresolvedSelections)
  return {
    ...base,
    schemaVersion: 4,
    identity: {
      ...base.identity,
      name: draft.name,
      player: draft.player,
      portrait: draft.portrait,
      concept: draft.concept,
      pronouns: draft.pronouns,
    },
    progression: {
      ...base.progression,
      level: draft.level,
      targetLevel: Math.max(base.progression.targetLevel, draft.level),
      creationMode: draft.level > 1 ? 'high-level' : base.progression.creationMode,
      choicesByLevel: buildChoicesByLevel(draft, previous),
    },
    ancestry: {
      ...base.ancestry,
      ancestryId: draft.ancestryId,
      heritageId: draft.heritageId || null,
      versatileHeritageId: draft.versatileHeritageId || null,
      boostMode: draft.attributeChoices.ancestryMode,
      freeBoosts: [...draft.attributeChoices.ancestryFreeBoosts],
      voluntaryFlaws: [...draft.attributeChoices.voluntaryFlaws],
      featChoicesByLevel: updateLevelOneChoices(
        base.ancestry.featChoicesByLevel,
        draft.ancestryFeatIds,
      ),
    },
    background: {
      backgroundId: draft.backgroundId,
      limitedBoost: draft.attributeChoices.backgroundLimitedBoost,
      freeBoost: draft.attributeChoices.backgroundFreeBoost,
    },
    class: {
      ...base.class,
      classId: draft.classId,
      keyAbility: draft.attributeChoices.classKeyBoost,
      specializationChoices: {
        ...base.class.specializationChoices,
        'class-specialization': draft.subclassId ? [draft.subclassId] : [],
      },
      featChoicesByLevel: updateLevelOneChoices(
        base.class.featChoicesByLevel,
        draft.classFeatIds,
      ),
    },
    attributes: {
      priorities: [...base.attributes.priorities],
      finalFreeBoosts: [...draft.attributeChoices.finalFreeBoosts],
      levelBoosts: {
        5: [...draft.attributeChoices.levelBoosts[5]],
        10: [...draft.attributeChoices.levelBoosts[10]],
        15: [...draft.attributeChoices.levelBoosts[15]],
        20: [...draft.attributeChoices.levelBoosts[20]],
      },
    },
    skills: {
      ...base.skills,
      grantedChoiceSelections: {
        ...draft.skillChoices.grantedChoiceSelections,
      },
      freeSelections: {
        ...base.skills.freeSelections,
        'class:level:1': [...draft.skillChoices.classFreeSkills],
        'intelligence:level:1': [...draft.skillChoices.intelligenceSkills],
      },
      replacementSelections: {
        ...draft.skillChoices.replacementSkills,
      },
      increasesByLevel: groupSkillIncreases(draft.skillChoices.skillIncreases),
      suggestedSkills: [...draft.skillChoices.suggestedSkills],
    },
    feats: {
      ...base.feats,
      suggestedSelectionsByType: featSuggestions,
    },
    details: {
      ...base.details,
      notes: draft.notes,
    },
    vitals: {
      currentHp: draft.currentHp,
      tempHp: draft.tempHp,
    },
    migration: {
      ...base.migration,
      needsReview: draft.needsRulesRebuild || base.migration.needsReview,
      unresolvedSelections: mergeUnresolvedSelections(
        base.migration.unresolvedSelections,
        runtimeUnresolved,
      ),
      legacyNotes: {
        lore: draft.lore,
        languages: draft.languages,
        equipment: draft.equipment,
      },
      legacySnapshot: base.migration.legacySnapshot ?? draft.legacySnapshot,
    },
  }
}

function flattenRecordValues(record: Record<number, string[]> | Record<string, string[]>) {
  return Array.from(new Set(Object.values(record).flat()))
}

function unresolvedSelectionsForRuntime(
  unresolved: Pathfinder2UnresolvedSelection[],
): Pathfinder2UnresolvedSelections {
  const valueFor = (kind: Pathfinder2UnresolvedSelection['kind']) => (
    unresolved.find(entry => entry.kind === kind)?.value
  )
  return {
    ...(valueFor('heritage') ? { heritageName: valueFor('heritage') } : {}),
    ...(valueFor('class-specialization')
      ? { subclassName: valueFor('class-specialization') }
      : {}),
    ...(valueFor('class-feat') ? { classFeatName: valueFor('class-feat') } : {}),
    ...(valueFor('skill-feat') ? { skillFeatName: valueFor('skill-feat') } : {}),
    ...(valueFor('general-feat')
      ? { generalFeatName: valueFor('general-feat') }
      : {}),
  }
}

function legacySnapshotForRuntime(value: unknown) {
  const snapshot = asRecord(value)
  const nestedSnapshot = asRecord(snapshot.legacySnapshot)
  const source = Object.keys(nestedSnapshot).length ? nestedSnapshot : snapshot
  const attributesRaw = asRecord(source.attributes)
  const hasAttributes = PATHFINDER2_ATTRIBUTES.some(
    attribute => typeof attributesRaw[attribute.key] === 'number',
  )
  const trainedSkills = asStringArray(source.trainedSkills)
  if (!hasAttributes && !trainedSkills.length) return null
  return {
    ...(hasAttributes
      ? {
        attributes: Object.fromEntries(
          PATHFINDER2_ATTRIBUTES.map(attribute => [
            attribute.key,
            asNumber(attributesRaw[attribute.key]),
          ]),
        ) as NonNullable<Pathfinder2CharacterDraft['legacySnapshot']>['attributes'],
      }
      : {}),
    ...(trainedSkills.length ? { trainedSkills } : {}),
  }
}

export function v4DraftToRuntime(
  value: Pathfinder2CharacterDraftV4,
): Pathfinder2CharacterDraft {
  const draft = normalizeV4(value)
  const levelBoosts = draft.attributes.levelBoosts
  const skillIncreases = Object.values(draft.skills.increasesByLevel)
    .flat()
    .sort((left, right) => left.level - right.level)
  const ancestryFeatIds = flattenRecordValues(draft.ancestry.featChoicesByLevel)
  const classFeatIds = flattenRecordValues(draft.class.featChoicesByLevel)
  const specialization = draft.class.specializationChoices['class-specialization']
    ?? Object.values(draft.class.specializationChoices)[0]
    ?? []

  return {
    ...createDefaultPathfinder2Draft(),
    name: draft.identity.name,
    player: draft.identity.player,
    pronouns: draft.identity.pronouns,
    concept: draft.identity.concept,
    level: draft.progression.level,
    portrait: draft.identity.portrait,
    ancestryId: draft.ancestry.ancestryId,
    heritageId: draft.ancestry.heritageId ?? '',
    versatileHeritageId: draft.ancestry.versatileHeritageId ?? '',
    backgroundId: draft.background.backgroundId,
    classId: draft.class.classId,
    subclassId: specialization[0] ?? '',
    attributeChoices: {
      ancestryMode: draft.ancestry.boostMode,
      ancestryFreeBoosts: [...draft.ancestry.freeBoosts],
      voluntaryFlaws: [...draft.ancestry.voluntaryFlaws],
      backgroundLimitedBoost: draft.background.limitedBoost,
      backgroundFreeBoost: draft.background.freeBoost,
      classKeyBoost: draft.class.keyAbility,
      finalFreeBoosts: [...draft.attributes.finalFreeBoosts],
      levelBoosts: {
        5: [...(levelBoosts[5] ?? [])],
        10: [...(levelBoosts[10] ?? [])],
        15: [...(levelBoosts[15] ?? [])],
        20: [...(levelBoosts[20] ?? [])],
      },
    },
    skillChoices: {
      grantedChoiceSelections: {
        ...draft.skills.grantedChoiceSelections,
      },
      classFreeSkills: [...(draft.skills.freeSelections['class:level:1'] ?? [])],
      intelligenceSkills: [
        ...(draft.skills.freeSelections['intelligence:level:1'] ?? []),
      ],
      replacementSkills: {
        ...draft.skills.replacementSelections,
      },
      skillIncreases,
      suggestedSkills: [...draft.skills.suggestedSkills],
    },
    lore: draft.migration.legacyNotes.lore
      || draft.skills.loreEntries.map(entry => entry.name).join(', '),
    ancestryFeatIds: ancestryFeatIds.length
      ? ancestryFeatIds
      : [...draft.feats.suggestedSelectionsByType['ancestry-feat']],
    classFeatIds: classFeatIds.length
      ? classFeatIds
      : [...draft.feats.suggestedSelectionsByType['class-feat']],
    skillFeatIds: [...draft.feats.suggestedSelectionsByType['skill-feat']],
    generalFeatIds: [
      ...draft.feats.suggestedSelectionsByType['general-feat'],
      ...draft.feats.suggestedSelectionsByType['mythic-feat'],
    ],
    languages: draft.migration.legacyNotes.languages
      || draft.details.languageChoices.join(', '),
    equipment: draft.migration.legacyNotes.equipment,
    notes: draft.details.notes,
    currentHp: draft.vitals.currentHp,
    tempHp: draft.vitals.tempHp,
    needsRulesRebuild: draft.migration.needsReview,
    legacySnapshot: legacySnapshotForRuntime(draft.migration.legacySnapshot),
    unresolvedSelections: unresolvedSelectionsForRuntime(
      draft.migration.unresolvedSelections,
    ),
  }
}

function addLegacyTextUnresolved(
  entries: Pathfinder2UnresolvedSelection[],
  kind: 'lore' | 'language' | 'equipment',
  value: string,
) {
  if (!value.trim()) return
  entries.push({
    id: `migration:legacy-${kind}`,
    kind,
    value,
    message: 'Свободный текст сохранён без автоматического сопоставления с ID справочника.',
    source: MIGRATION_SOURCE,
  })
}

function addLegacyFeatUnresolved(
  entries: Pathfinder2UnresolvedSelection[],
  kind: 'ancestry-feat' | 'class-feat' | 'skill-feat' | 'general-feat',
  featIds: string[],
) {
  featIds.forEach(featId => {
    entries.push({
      id: `migration:${kind}:${featId}`,
      kind,
      value: featId,
      suggestedId: featId,
      message: 'Выбор сохранён как предложение до появления проверяемого слота черты.',
      source: MIGRATION_SOURCE,
    })
  })
}

function migrateLegacyToV4(
  value: unknown,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2MigrationV4Result {
  const legacy = migratePathfinder2Draft(value, catalog)
  const unresolved = runtimeUnresolvedSelections(
    legacy.draft.unresolvedSelections,
  )
  addLegacyTextUnresolved(unresolved, 'lore', legacy.draft.lore)
  addLegacyTextUnresolved(unresolved, 'language', legacy.draft.languages)
  addLegacyTextUnresolved(unresolved, 'equipment', legacy.draft.equipment)
  addLegacyFeatUnresolved(unresolved, 'ancestry-feat', legacy.draft.ancestryFeatIds)
  addLegacyFeatUnresolved(unresolved, 'class-feat', legacy.draft.classFeatIds)
  addLegacyFeatUnresolved(unresolved, 'skill-feat', legacy.draft.skillFeatIds)
  addLegacyFeatUnresolved(unresolved, 'general-feat', legacy.draft.generalFeatIds)

  const draft = runtimeDraftToV4(legacy.draft)
  draft.migration = {
    needsReview: true,
    unresolvedSelections: mergeUnresolvedSelections(unresolved),
    legacyNotes: {
      lore: legacy.draft.lore,
      languages: legacy.draft.languages,
      equipment: legacy.draft.equipment,
    },
    legacySnapshot: value,
  }
  const runtimeDraft = v4DraftToRuntime(draft)
  return {
    draft,
    runtimeDraft,
    warnings: Array.from(new Set([
      ...legacy.warnings,
      'Черновик перенесён в schema v4. Свободные строки и выборы без проверяемых слотов требуют подтверждения.',
    ])),
    migrated: true,
  }
}

export function migratePathfinder2DraftV4(
  value: unknown,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2MigrationV4Result {
  const raw = asRecord(value)
  if (raw.schemaVersion !== 4) return migrateLegacyToV4(value, catalog)

  const draft = normalizeV4(raw)
  const runtimeDraft = v4DraftToRuntime(draft)
  const checkedRuntime = migratePathfinder2Draft(runtimeDraft, catalog)
  const checkedDraft = runtimeDraftToV4(checkedRuntime.draft, draft)
  return {
    draft: checkedDraft,
    runtimeDraft: checkedRuntime.draft,
    warnings: checkedRuntime.warnings,
    migrated: false,
  }
}

export function parseAndMigratePathfinder2DraftV4(
  raw: string,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2MigrationV4Result | null {
  try {
    return migratePathfinder2DraftV4(JSON.parse(raw) as unknown, catalog)
  } catch {
    return null
  }
}
