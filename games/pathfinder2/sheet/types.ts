export type Pathfinder2StepId =
  | 'concept'
  | 'origin'
  | 'class'
  | 'attributes'
  | 'skills'
  | 'equipment'

export type Pathfinder2AttributeKey =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma'

export type Pathfinder2Attributes = Record<Pathfinder2AttributeKey, number>

export type Pathfinder2CharacterDraft = {
  name: string
  player: string
  pronouns: string
  concept: string
  level: number
  ancestryId: string
  heritage: string
  backgroundId: string
  classId: string
  keyAbility: Pathfinder2AttributeKey | ''
  specialization: string
  classFeat: string
  attributes: Pathfinder2Attributes
  trainedSkills: string[]
  lore: string
  languages: string
  generalFeat: string
  equipment: string
  notes: string
}
