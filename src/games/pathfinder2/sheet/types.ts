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

export type Pathfinder2CharacterDraft = {
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

export type Pathfinder2RulesCatalog = {
  ancestries: Pathfinder2AncestryRule[]
  versatileHeritages: Pathfinder2VersatileHeritageRule[]
  backgrounds: Pathfinder2BackgroundRule[]
  classes: Pathfinder2ClassRule[]
  generalFeats: Pathfinder2FeatRule[]
  skillFeats: Pathfinder2FeatRule[]
  mythicFeats: Pathfinder2FeatRule[]
  sources: Pathfinder2RuleSource[]
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
  field?: string
  message: string
}

export type Pathfinder2CharacterBuild = {
  attributes: Pathfinder2CalculatedAttributes
  skills: Pathfinder2CalculatedSkills
  validationIssues: Pathfinder2ValidationIssue[]
  isReady: boolean
}
