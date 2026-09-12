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
 * chronological order up to the timeline's current moment to resolve the
 * character's current border/state — see `resolveCharacterState` in
 * `timeline.ts`. `kind`/`alive` are each optional: an event can touch just
 * one of them (e.g. a death event that doesn't change species).
 *
 * `year` is the only required part of the date; `month`/`day` are an optional
 * refinement, for stretches of the timeline where a single year holds dozens
 * of events. An event that knows only its year is ordered at the start of
 * that year — see `eventOrdinal` in `timeline.ts`.
 */
export type CharacterEvent = {
  id: string
  year: number
  /** 1–12, or `null` when only the year is known. */
  month: number | null
  /** 1–31, or `null` when only the year (or year + month) is known. */
  day: number | null
  dateLabel: string
  title: string
  description: string
  kind?: CharacterKind
  alive?: boolean
  /**
   * Relationships that start at this event — the event↔relationship link.
   * Maintained by the route when a character-event relationship draft is
   * saved; the authoritative binding is `sourceEventId` on the relationship's
   * own appearance event, this is the convenience index for the panel.
   */
  relationshipIds?: string[]
}

/**
 * A timestamped change to how a relationship renders. Applied in
 * chronological order up to the timeline's current moment on top of the
 * relationship's base label/color/description — see
 * `resolveRelationshipState` in `timeline.ts`. Every field but the date is
 * optional: an event can, say, only rename the relationship without touching
 * its color.
 *
 * Relationships only ever *appear*: `appears` marks the moment the line
 * starts existing, and before it the edge is not drawn at all. A relationship
 * with no `appears` event anywhere is simply always on the map (the date
 * hasn't been decided yet). There is deliberately no "disappears" — a legacy
 * `active: false` flag is dropped on read by `normalizeRelationshipEvent`.
 */
export type RelationshipEvent = {
  id: string
  year: number
  /** 1–12, or `null` when only the year is known. */
  month: number | null
  /** 1–31, or `null` when only the year (or year + month) is known. */
  day: number | null
  dateLabel: string
  title: string
  /** `true` on the event where this relationship starts existing. */
  appears?: boolean
  /** Set when this appearance was built from a character's timeline event. */
  sourceCharacterId?: string
  sourceEventId?: string
  label?: string
  color?: string
  description?: string
}

/**
 * A relationship line the owner is building from inside a character's event
 * ("at this event a relationship with X starts"). Panel-level draft, applied
 * by `CharactersMapRoute` on save: `id === null` creates the relationship,
 * otherwise it patches the existing one, and either way the relationship's
 * appearance event is stamped with the character event's date and id.
 */
export type EventRelationshipDraft = {
  /** Stable React key — a relationship id once saved, a local uuid before that. */
  key: string
  /** `null` for a line that doesn't exist yet. */
  id: string | null
  /** Character event this line appears at. */
  eventId: string
  targetCharacterId: string
  /** `out` = this character → target, `in` = target → this character. */
  direction: 'out' | 'in' | 'mutual'
  label: string
  color: string
  description: string
}

export type DamageTrack = {
  max: number
  boxes: number[] // 0 = empty, 1 = superficial, 2 = aggravated
}

export type GalleryCategory = 'house' | 'pet' | 'event' | 'other'

/** One photo in a character's gallery — their home, pets, or a notable event. */
export type GalleryItem = {
  id: string
  imagePath: string
  caption: string
  category: GalleryCategory
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
  /** Photos of the character's home, pets, and notable events — separate from the portrait. */
  gallery: GalleryItem[]
}

/**
 * Cached English machine translation of a character's owner-authored free
 * text, keyed by discipline/event/gallery-item id so it survives reordering.
 * `sourceHash` is a content hash of the fields below (not `updatedAt` —
 * that timestamp also bumps on a plain canvas drag) used to detect when the
 * Russian source has changed since this was generated. Any field the
 * translator didn't return is simply absent/empty, so display code should
 * fall back to the Russian original per-field rather than assume this is
 * complete. See `localizeCharacter` in `i18n.ts`.
 */
export type CharacterTranslation = {
  name: string
  description: string
  concept: string
  clan: string
  generation: string
  predatorType: string
  sire: string
  ambition: string
  desire: string
  touchstones: string
  merits: string
  flaws: string
  birthDateLabel: string
  disciplines: Record<string, string>
  events: Record<string, { title: string; description: string }>
  gallery: Record<string, string>
  sourceHash: string
  translatedAt: string
}

export type MapCharacter = {
  id: string
  name: string
  description: string
  imagePath: string | null
  positionX: number
  positionY: number
  sheet: CharacterSheet
  translationEn: CharacterTranslation | null
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
  translation_en: unknown
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

export type MapCharacterPatch = Partial<MapCharacterInput> & {
  translationEn?: CharacterTranslation | null
}

/** Cached English translation of a relationship's label/description and its
 * event overrides (by event id, only for whichever of title/label/description
 * that event itself sets). See `CharacterTranslation` for the staleness model. */
export type RelationshipTranslation = {
  label: string
  description: string
  events: Record<string, { title?: string; label?: string; description?: string }>
  sourceHash: string
  translatedAt: string
}

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
  translationEn: RelationshipTranslation | null
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
  translation_en: unknown
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

export type MapRelationshipPatch = Partial<MapRelationshipInput> & {
  events?: RelationshipEvent[]
  translationEn?: RelationshipTranslation | null
}
