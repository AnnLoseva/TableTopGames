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

/** The map's own species/state model — independent of VTM clans, which stay a free-text sheet field. */
export type CharacterKind = 'human' | 'vampire' | 'ghost'

/**
 * A timestamped change to a character's kind and/or alive status. Applied in
 * chronological order up to the timeline's current year to resolve the
 * character's current border/state — see `resolveCharacterState` in
 * `timeline.ts`. `kind`/`alive` are each optional: an event can touch just
 * one of them (e.g. a death event that doesn't change species).
 */
export type CharacterEvent = {
  id: string
  year: number
  dateLabel: string
  title: string
  description: string
  kind?: CharacterKind
  alive?: boolean
}

/**
 * A timestamped change to how a relationship renders. Applied in
 * chronological order up to the timeline's current year on top of the
 * relationship's base label/color/description — see
 * `resolveRelationshipState` in `timeline.ts`. Every field is optional: an
 * event can, say, only flip `active` (the pair had a falling out) without
 * touching color or label.
 */
export type RelationshipEvent = {
  id: string
  year: number
  dateLabel: string
  title: string
  active?: boolean
  label?: string
  color?: string
  description?: string
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
  /** null = birth date unknown/unset — the character is never hidden by the timeline. */
  birthYear: number | null
  birthDateLabel: string
  /** Species/state before any `events` apply — everyone starts human by default. */
  baseKind: CharacterKind
  events: CharacterEvent[]
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
  events: RelationshipEvent[]
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
  events: unknown
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

export type MapRelationshipPatch = Partial<Omit<MapRelationshipInput, 'fromCharacterId' | 'toCharacterId'>> & {
  events?: RelationshipEvent[]
}
