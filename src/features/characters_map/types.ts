export type RelationshipKind = 'directed' | 'mutual'

export type AttributeKey =
  | 'strength' | 'dexterity' | 'stamina'
  | 'charisma' | 'manipulation' | 'composure'
  | 'intelligence' | 'wits' | 'resolve'

export type SkillKey =
  | 'athletics' | 'brawl' | 'craft' | 'drive' | 'firearms' | 'larceny' | 'melee' | 'stealth' | 'survival'
  | 'animalKen' | 'etiquette' | 'insight' | 'intimidation' | 'leadership' | 'performance' | 'persuasion' | 'streetwise' | 'subterfuge'
  | 'academics' | 'awareness' | 'finance' | 'investigation' | 'medicine' | 'occult' | 'politics' | 'science' | 'technology'

export type Discipline = {
  id: string
  name: string
  level: number
}

export type DamageTrack = {
  max: number
  boxes: number[] // 0 = empty, 1 = superficial, 2 = aggravated
}

export type CharacterSheet = {
  concept: string
  clan: string
  generation: string
  predatorType: string
  sire: string
  ambition: string
  desire: string
  attributes: Partial<Record<AttributeKey, number>>
  skills: Partial<Record<SkillKey, number>>
  disciplines: Discipline[]
  health: DamageTrack
  willpower: DamageTrack
  humanity: number
  stains: number
  bloodPotency: number
  touchstones: string
  merits: string
  flaws: string
}

export type MapCharacter = {
  id: string
  name: string
  description: string
  imagePath: string | null
  positionX: number
  positionY: number
  sheet: CharacterSheet
  createdAt: string
  updatedAt: string
}

export type MapCharacterRow = {
  id: string
  user_id: string
  name: string
  description: string
  image_path: string | null
  position_x: number
  position_y: number
  sheet: unknown
  created_at: string
  updated_at: string
}

export type MapCharacterInput = {
  name: string
  description: string
  imagePath?: string | null
  positionX?: number
  positionY?: number
  sheet?: CharacterSheet
}

export type MapCharacterPatch = Partial<MapCharacterInput>

export type MapRelationship = {
  id: string
  fromCharacterId: string
  toCharacterId: string
  kind: RelationshipKind
  label: string
  description: string
  color: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type MapRelationshipRow = {
  id: string
  user_id: string
  from_character_id: string
  to_character_id: string
  kind: string
  label: string
  description: string
  color: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type MapRelationshipInput = {
  fromCharacterId: string
  toCharacterId: string
  kind: RelationshipKind
  label: string
  description?: string
  color?: string | null
}

export type MapRelationshipPatch = Partial<Omit<MapRelationshipInput, 'fromCharacterId' | 'toCharacterId'>>
