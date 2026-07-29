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

export type Pathfinder2UnresolvedSelections = {
  heritageName?: string
  subclassName?: string
  classFeatName?: string
  skillFeatName?: string
  generalFeatName?: string
}

export type Pathfinder2CharacterDraft = {
  schemaVersion: 2
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
  keyAbility: Pathfinder2AttributeKey | ''
  attributes: Pathfinder2Attributes
  trainedSkills: string[]
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
  unresolvedSelections: Pathfinder2UnresolvedSelections
}

export type Pathfinder2RuleFeature = {
  id: string
  name: string
  description: string
  level?: number
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
  trainedSkills: string
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
