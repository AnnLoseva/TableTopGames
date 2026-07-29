export type Pathfinder2Mode = 'sheet' | 'builder'

export type Pathfinder2BuilderStepId =
  | 'concept'
  | 'ancestry'
  | 'heritage'
  | 'background'
  | 'class'
  | 'attributes'
  | 'skills'
  | 'feats'
  | 'equipment'
  | 'review'

export type Pathfinder2StepId = Pathfinder2BuilderStepId

export type Pathfinder2SheetTab =
  | 'overview'
  | 'skills'
  | 'feats'
  | 'equipment'
  | 'spells'
  | 'notes'

export type Pathfinder2ChoiceKind =
  | 'ancestry'
  | 'heritage'
  | 'versatileHeritage'
  | 'background'
  | 'class'
  | 'generalFeat'
  | 'skillFeat'

export type Pathfinder2StepState = 'not-started' | 'partial' | 'complete' | 'error'

export type Pathfinder2AttributeKey =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma'

export type Pathfinder2Attributes = Record<Pathfinder2AttributeKey, number>

export type Pathfinder2AttributeMode = 'standard' | 'alternate'

export type Pathfinder2AttributeLevel = 5 | 10 | 15 | 20

export type Pathfinder2AttributeChoices = {
  ancestryMode: Pathfinder2AttributeMode
  ancestryFreeBoosts: Pathfinder2AttributeKey[]
  backgroundLimitedBoost: Pathfinder2AttributeKey | null
  backgroundFreeBoost: Pathfinder2AttributeKey | null
  classKeyBoost: Pathfinder2AttributeKey | null
  finalFreeBoosts: Pathfinder2AttributeKey[]
  levelBoosts: Record<Pathfinder2AttributeLevel, Pathfinder2AttributeKey[]>
}

export type Pathfinder2SkillId =
  | 'acrobatics'
  | 'arcana'
  | 'athletics'
  | 'crafting'
  | 'deception'
  | 'diplomacy'
  | 'intimidation'
  | 'medicine'
  | 'nature'
  | 'occultism'
  | 'performance'
  | 'religion'
  | 'society'
  | 'stealth'
  | 'survival'
  | 'thievery'

export type Pathfinder2ProficiencyRank =
  | 'untrained'
  | 'trained'
  | 'expert'
  | 'master'
  | 'legendary'

export type Pathfinder2CharacterSourceType =
  | 'ancestry'
  | 'heritage'
  | 'background'
  | 'class'
  | 'class-feature'
  | 'feat'
  | 'equipment'
  | 'spell'
  | 'level'
  | 'custom'
  | 'migration'

export type Pathfinder2CharacterSource = {
  type: Pathfinder2CharacterSourceType
  id: string
  label: string
  level?: number
}

export type Pathfinder2ProficiencyCategory =
  | 'perception'
  | 'fortitude'
  | 'reflex'
  | 'will'
  | 'skill'
  | 'weapon'
  | 'armor'
  | 'class-dc'
  | 'spell-attack'
  | 'spell-dc'

export type Pathfinder2ProficiencyGrant = {
  category: Pathfinder2ProficiencyCategory
  targetId?: string
  rank: Pathfinder2ProficiencyRank
  level: number
  source: Pathfinder2CharacterSource
}

export type Pathfinder2ClassChoiceOption = {
  id: string
  label: string
  description: string
  sourceId?: string
}

export type Pathfinder2ClassChoiceDefinition = {
  id: string
  classId: string
  label: string
  level: number
  required: boolean
  count: number
  options: Pathfinder2ClassChoiceOption[]
}

export type Pathfinder2FeatSlotType =
  | 'ancestry-feat'
  | 'class-feat'
  | 'skill-feat'
  | 'general-feat'
  | 'archetype-feat'
  | 'bonus-feat'
  | 'mythic-feat'

export type Pathfinder2DecisionSlot<Type extends string = string> = {
  id: string
  level: number
  type: Type
  source: Pathfinder2CharacterSource
  required: boolean
  count: number
  selectedIds: string[]
}

export type Pathfinder2FeatSlot = Omit<
  Pathfinder2DecisionSlot<Pathfinder2FeatSlotType>,
  'count' | 'selectedIds'
> & {
  selectedFeatId: string | null
}

export type Pathfinder2Requirement =
  | { type: 'level'; minimum: number }
  | {
    type: 'attribute'
    attribute: Pathfinder2AttributeKey
    minimum: number
  }
  | {
    type: 'skill-rank'
    skillId: Pathfinder2SkillId
    minimum: Pathfinder2ProficiencyRank
  }
  | { type: 'class'; classId: string }
  | { type: 'ancestry'; ancestryId: string }
  | { type: 'heritage'; heritageId: string }
  | { type: 'feat'; featId: string }
  | {
    type: 'proficiency'
    category: Pathfinder2ProficiencyCategory
    minimum: Pathfinder2ProficiencyRank
  }
  | { type: 'feature'; featureId: string }
  | { type: 'custom'; description: string }

export type Pathfinder2LoreEntry = {
  id: string
  name: string
  rank: Pathfinder2ProficiencyRank
  source: Pathfinder2CharacterSource
  custom: boolean
}

export type Pathfinder2SkillIncrease = {
  level: number
  skillId: Pathfinder2SkillId
  fromRank: Pathfinder2ProficiencyRank
  toRank: Pathfinder2ProficiencyRank
}

export type Pathfinder2SkillChoices = {
  grantedChoiceSelections: Record<string, Pathfinder2SkillId[]>
  classFreeSkills: Pathfinder2SkillId[]
  intelligenceSkills: Pathfinder2SkillId[]
  replacementSkills: Record<string, Pathfinder2SkillId>
  skillIncreases: Pathfinder2SkillIncrease[]
  suggestedSkills: Pathfinder2SkillId[]
}

export type Pathfinder2SkillChoiceRule = {
  id: string
  label: string
  count: number
  allowedSkills?: Pathfinder2SkillId[]
  excludedSkills?: Pathfinder2SkillId[]
  sourceLabel: string
}

export type Pathfinder2GrantedSkillRule = {
  skillId: Pathfinder2SkillId
  sourceLabel: string
}

export type Pathfinder2ClassSkillRules = {
  grantedSkills: Pathfinder2GrantedSkillRule[]
  grantedSkillChoices: Pathfinder2SkillChoiceRule[]
  baseFreeTrainedSkills: number
  addIntelligenceModifier: boolean
  skillIncreaseLevels: number[]
}

export type Pathfinder2BackgroundSkillRules = {
  grantedSkills: Pathfinder2GrantedSkillRule[]
  grantedSkillChoices: Pathfinder2SkillChoiceRule[]
}

export type Pathfinder2UnresolvedSelections = {
  heritageName?: string
  subclassName?: string
  classFeatName?: string
  skillFeatName?: string
  generalFeatName?: string
}

export type Pathfinder2CharacterDraftV3 = {
  schemaVersion: 3
  name: string
  player: string
  pronouns: string
  concept: string
  level: number
  portrait: string
  ancestryId: string
  heritageId: string
  versatileHeritageId: string
  backgroundId: string
  classId: string
  subclassId: string
  attributeChoices: Pathfinder2AttributeChoices
  skillChoices: Pathfinder2SkillChoices
  lore: string
  ancestryFeatIds: string[]
  classFeatIds: string[]
  skillFeatIds: string[]
  generalFeatIds: string[]
  languages: string
  equipment: string
  notes: string
  currentHp: number
  tempHp: number
  needsRulesRebuild: boolean
  legacySnapshot: {
    attributes?: Pathfinder2Attributes
    trainedSkills?: string[]
  } | null
  unresolvedSelections: Pathfinder2UnresolvedSelections
}

/**
 * Transitional runtime shape used by the existing level-1 UI and rules engine.
 * Local persistence is schema v4; `data/migration-v4.ts` owns the adapter.
 */
export type Pathfinder2CharacterDraft = Pathfinder2CharacterDraftV3

export type Pathfinder2SpellTradition =
  | 'arcane'
  | 'divine'
  | 'occult'
  | 'primal'

export type Pathfinder2SpellcastingMode =
  | 'spontaneous'
  | 'prepared'
  | 'spellbook-prepared'
  | 'bounded'
  | 'focus-only'
  | 'innate'

export type Pathfinder2SpellcastingEntry = {
  id: string
  source: Pathfinder2CharacterSource
  tradition: Pathfinder2SpellTradition
  mode: Pathfinder2SpellcastingMode
  castingAttribute: Pathfinder2AttributeKey
  proficiencyRank: Pathfinder2ProficiencyRank
  cantripSlots: number
  spellSlots: Record<number, number>
  repertoireSpellIds: Record<number, string[]>
  preparedSpellIds: Record<number, Array<string | null>>
  spellbookSpellIds: string[]
  focusSpellIds: string[]
  focusPoints: number
}

export type Pathfinder2CurrencyAmount = {
  cp: number
  sp: number
  gp: number
  pp: number
}

export type Pathfinder2EquipmentCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'adventuring-gear'
  | 'tool'
  | 'consumable'
  | 'alchemical'
  | 'ammunition'
  | 'clothing'
  | 'container'
  | 'kit'
  | 'other'

export type Pathfinder2EquipmentItem = {
  id: string
  name: string
  level: number
  rarity: 'common' | 'uncommon' | 'rare' | 'unique'
  price: Pathfinder2CurrencyAmount
  bulk: number | 'light'
  traits: string[]
  category: Pathfinder2EquipmentCategory
  sourceBook: string
}

export type Pathfinder2InventoryEntry = {
  id: string
  itemId: string
  quantity: number
  purchasePrice: Pathfinder2CurrencyAmount
  equipped: boolean
  invested: boolean
  carried: boolean
  containerEntryId: string | null
  customName: string
  notes: string
}

export type Pathfinder2UnresolvedSelectionKind =
  | 'heritage'
  | 'class-specialization'
  | 'ancestry-feat'
  | 'class-feat'
  | 'skill-feat'
  | 'general-feat'
  | 'language'
  | 'equipment'
  | 'lore'
  | 'custom'

export type Pathfinder2UnresolvedSelection = {
  id: string
  kind: Pathfinder2UnresolvedSelectionKind
  value: string
  suggestedId?: string
  message: string
  source: Pathfinder2CharacterSource
}

export type Pathfinder2LevelChoices = {
  level: number
  attributeBoosts: Pathfinder2AttributeKey[]
  skillIncreases: Pathfinder2SkillIncrease[]
  featSelections: Record<string, string>
  classFeatureChoices: Record<string, string[]>
  learnedSpellIds: string[]
  removedSpellIds: string[]
  languageChoices: string[]
}

export type Pathfinder2CharacterDraftV4 = {
  schemaVersion: 4
  identity: {
    name: string
    player: string
    portrait: string
    concept: string
    backstory: string
    age: string
    gender: string
    pronouns: string
    regionId: string | null
    partyRole: string
    connections: string
    preliminaryFaith: string
  }
  progression: {
    level: number
    targetLevel: number
    creationMode: 'level-1' | 'high-level'
    experience: number
    heroPoints: number
    completedLevels: number[]
    choicesByLevel: Record<number, Pathfinder2LevelChoices>
  }
  ancestry: {
    ancestryId: string
    heritageId: string | null
    versatileHeritageId: string | null
    boostMode: Pathfinder2AttributeMode
    freeBoosts: Pathfinder2AttributeKey[]
    voluntaryFlaws: Pathfinder2AttributeKey[]
    featChoicesByLevel: Record<number, string[]>
  }
  background: {
    backgroundId: string
    limitedBoost: Pathfinder2AttributeKey | null
    freeBoost: Pathfinder2AttributeKey | null
  }
  class: {
    classId: string
    keyAbility: Pathfinder2AttributeKey | null
    specializationChoices: Record<string, string[]>
    featChoicesByLevel: Record<number, string[]>
  }
  attributes: {
    finalFreeBoosts: Pathfinder2AttributeKey[]
    levelBoosts: Record<number, Pathfinder2AttributeKey[]>
  }
  skills: {
    grantedChoiceSelections: Record<string, Pathfinder2SkillId[]>
    freeSelections: Record<string, Pathfinder2SkillId[]>
    replacementSelections: Record<string, Pathfinder2SkillId>
    increasesByLevel: Record<number, Pathfinder2SkillIncrease[]>
    loreEntries: Pathfinder2LoreEntry[]
    suggestedSkills: Pathfinder2SkillId[]
  }
  feats: {
    selectedBySlot: Record<string, string>
    suggestedSelectionsByType: Record<Pathfinder2FeatSlotType, string[]>
  }
  spellcasting: {
    entries: Pathfinder2SpellcastingEntry[]
  }
  inventory: {
    entries: Pathfinder2InventoryEntry[]
    currency: Pathfinder2CurrencyAmount
  }
  details: {
    deityId: string | null
    religionText: string
    sanctification: 'holy' | 'unholy' | 'none'
    personalEdicts: string[]
    personalAnathema: string[]
    languageChoices: string[]
    customLanguages: string[]
    notes: string
  }
  vitals: {
    currentHp: number
    tempHp: number
  }
  migration: {
    needsReview: boolean
    unresolvedSelections: Pathfinder2UnresolvedSelection[]
    legacyNotes: {
      lore: string
      languages: string
      equipment: string
    }
    legacySnapshot: unknown | null
  }
}

export type Pathfinder2RuleFeature = {
  id: string
  name: string
  description: string
  level?: number
  grantedSkills?: Pathfinder2GrantedSkillRule[]
}

export type Pathfinder2SpecialAbilityRule = {
  name: string
  description: string
}

export type Pathfinder2HeritageRule = {
  id: string
  name: string
  description: string
  traits: string[]
  ancestryId: string
  ancestryName: string
}

export type Pathfinder2VersatileHeritageRule = {
  id: string
  name: string
  altName: string
  tagline: string
  description: string
  traits: string[]
  senses: string[]
  mechanics: string
  sourceBook: string
  negativeHealing: boolean
}

export type Pathfinder2AncestryRule = {
  id: string
  name: string
  tagline: string
  description: string
  rarity: string
  traits: string[]
  youMight: string[]
  othersProbably: string[]
  popularEdicts: string[]
  popularAnathema: string[]
  sampleNames: string
  hp: number
  speed: number
  size: string
  abilityBoosts: string[]
  abilityFlaw: string | null
  languages: string[]
  bonusLanguages: string
  senses: string[]
  specialAbilities: Pathfinder2SpecialAbilityRule[]
  heritages: Pathfinder2HeritageRule[]
  sourceBook: string
}

export type Pathfinder2BackgroundRule = {
  id: string
  name: string
  description: string
  rarity: string
  abilityBoosts: string
  abilityBoostOptions: Pathfinder2AttributeKey[]
  trainedSkills: string
  skillRules: Pathfinder2BackgroundSkillRules
  trainedLore: string
  skillFeat: string
  sourceBook: string
  tab: string
  region: string | null
}

export type Pathfinder2ClassRoleplayingRule = {
  combat: string
  social: string
  exploration: string
  downtime: string
  youMight: string[]
  othersProbably: string[]
}

export type Pathfinder2ClassRule = {
  id: string
  name: string
  description: string
  rarity: string
  role: string
  hp: number
  keyAbilities: Pathfinder2AttributeKey[]
  perception: string
  fortitude: string
  reflex: string
  will: string
  skills: string
  skillRules: Pathfinder2ClassSkillRules
  attacks: string
  defenses: string
  classDc: string
  spellTradition: string | null
  spellSlots: Record<string, number[]> | null
  keyTerms: Pathfinder2RuleFeature[]
  roleplaying: Pathfinder2ClassRoleplayingRule
  features: Pathfinder2RuleFeature[]
  specializations: Pathfinder2RuleFeature[]
  sourceBook: string
}

export type Pathfinder2FeatRule = {
  id: string
  name: string
  level: number
  description: string
  prerequisites: string | null
  traits: string[]
  skill?: string
  sourceBook?: string
}

export type Pathfinder2RuleSource = {
  id: 'ancestries' | 'backgrounds' | 'classes' | 'feats'
  title: string
  version: string
  source: string
}

export type Pathfinder2CatalogId =
  | 'ancestries'
  | 'backgrounds'
  | 'classes'
  | 'general-feats'
  | 'ancestry-feats'
  | 'class-feats'
  | 'class-progression'
  | 'archetypes'
  | 'equipment'
  | 'weapons'
  | 'armor'
  | 'shields'
  | 'spells'
  | 'deities'
  | 'languages'
  | 'traits'

export type Pathfinder2CatalogStatus =
  | 'connected'
  | 'partial'
  | 'available-not-connected'
  | 'missing'
  | 'invalid'

export type Pathfinder2CatalogAvailability = {
  id: Pathfinder2CatalogId
  label: string
  status: Pathfinder2CatalogStatus
  entryCount: number
  file: string | null
  requiredFor: Array<
    'level-1' | 'feats' | 'equipment' | 'spellcasting' | 'progression' | 'details'
  >
  issues: string[]
}

export type Pathfinder2RulesCatalog = {
  ancestries: Pathfinder2AncestryRule[]
  versatileHeritages: Pathfinder2VersatileHeritageRule[]
  backgrounds: Pathfinder2BackgroundRule[]
  classes: Pathfinder2ClassRule[]
  generalFeats: Pathfinder2FeatRule[]
  skillFeats: Pathfinder2FeatRule[]
  mythicFeats: Pathfinder2FeatRule[]
  sources: Pathfinder2RuleSource[]
  dataAvailability: Pathfinder2CatalogAvailability[]
  validationWarnings: string[]
}

export type Pathfinder2DerivedValues = {
  maxHp: number | null
  armorClass: number
  perception: number
  classDc: number | null
  fortitude: number
  reflex: number
  will: number
  speed: number | null
  proficiency: number
  keyAbility: Pathfinder2AttributeKey | ''
}

export type Pathfinder2AttributeBreakdownEntry = {
  source: 'ancestry' | 'background' | 'class' | 'free' | 'level'
  sourceLabel: string
  delta: number
  automatic: boolean
  partial: boolean
}

export type Pathfinder2CalculatedAttributes = {
  modifiers: Pathfinder2Attributes
  breakdown: Record<Pathfinder2AttributeKey, Pathfinder2AttributeBreakdownEntry[]>
  partialBoosts: Record<Pathfinder2AttributeKey, number>
}

export type Pathfinder2SkillSource = {
  id: string
  label: string
  kind: 'granted' | 'choice' | 'replacement' | 'increase'
}

export type Pathfinder2ReplacementChoice = {
  id: string
  duplicateSkillId: Pathfinder2SkillId
  sourceLabel: string
  reason: string
}

export type Pathfinder2CalculatedSkill = {
  skillId: Pathfinder2SkillId
  attribute: Pathfinder2AttributeKey
  attributeModifier: number
  rank: Pathfinder2ProficiencyRank
  proficiencyBonus: number
  modifier: number
  sources: Pathfinder2SkillSource[]
}

export type Pathfinder2CalculatedSkills = {
  skills: Record<Pathfinder2SkillId, Pathfinder2CalculatedSkill>
  grantedSkills: Pathfinder2SkillId[]
  replacementChoices: Pathfinder2ReplacementChoice[]
  classFreeLimit: number
  intelligenceLimit: number
  trainedCount: number
}

export type Pathfinder2ValidationIssue = {
  id: string
  severity: 'error' | 'warning' | 'info'
  step: Pathfinder2BuilderStepId
  section?: string
  field?: string
  level?: number
  message: string
  relatedChoiceId?: string
}

export type Pathfinder2CharacterBuild = {
  attributes: Pathfinder2CalculatedAttributes
  skills: Pathfinder2CalculatedSkills
  validationIssues: Pathfinder2ValidationIssue[]
  isReady: boolean
}
