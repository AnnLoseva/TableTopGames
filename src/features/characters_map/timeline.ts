import { CHARACTER_KIND_BORDER_COLORS, DEAD_BORDER_COLOR } from './constants'
import { monthName, t, type MapLanguage } from './i18n'
import type {
  CharacterEvent,
  CharacterKind,
  MapCharacter,
  MapRelationship,
  RelationshipEvent,
  RelationshipKind,
} from './types'

/**
 * Where the timeline cursor currently stands. Always a concrete day: the
 * year slider parks it on 31 December of the chosen year ("the state at the
 * end of that year", which is exactly how the timeline behaved when it was
 * year-only), and the prev/next stepper parks it on an event's own date.
 */
export type TimelineMoment = { year: number; month: number; day: number }

/** Anything carrying the optional-date shape events use. */
export type DatedLike = { year: number; month: number | null; day: number | null }

export function makeMoment(year: number, month = 12, day = 31): TimelineMoment {
  return { year, month, day }
}

/** The cursor position the year slider produces: the end of that year. */
export function yearMoment(year: number): TimelineMoment {
  return makeMoment(year, 12, 31)
}

/**
 * Sortable key for a date, `YYYYMMDD`-style. An event that knows only its
 * year lands at the very start of that year (`…0000`), so "sometime in 2026"
 * is in force from 1 January 2026 onward — the coarse entries never hide
 * behind the dated ones written later in the same year.
 */
export function eventOrdinal(date: DatedLike): number {
  if (!Number.isFinite(date.year)) return date.year > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  return date.year * 10000 + (date.month ?? 0) * 100 + (date.month === null ? 0 : date.day ?? 0)
}

export function momentOrdinal(moment: TimelineMoment): number {
  return eventOrdinal(moment)
}

/** Chronological comparator for anything dated — use it instead of `a.year - b.year`. */
export function compareDated(a: DatedLike, b: DatedLike): number {
  return eventOrdinal(a) - eventOrdinal(b)
}

/** `2026`, `март 2026`, `12 марта 2026` — whichever precision the date has. */
export function formatEventDate(date: DatedLike, language: MapLanguage): string {
  if (date.month === null) return String(date.year)
  if (date.day === null) return `${monthName(date.month, language)} ${date.year}`
  if (language === 'en') return `${monthName(date.month, 'en')} ${date.day}, ${date.year}`
  return `${date.day} ${monthName(date.month, 'ru', 'genitive')} ${date.year}`
}

/** Short form for the timeline bar and the year badges: `2026` / `12.03.2026`. */
export function formatShortDate(date: DatedLike, language: MapLanguage): string {
  if (date.month === null) return String(date.year)
  const month = String(date.month).padStart(2, '0')
  if (date.day === null) return language === 'en' ? `${month}/${date.year}` : `${month}.${date.year}`
  const day = String(date.day).padStart(2, '0')
  return language === 'en' ? `${month}/${day}/${date.year}` : `${day}.${month}.${date.year}`
}

export type ResolvedCharacterState = {
  kind: CharacterKind
  alive: boolean
  borderColor: string
}

/** Folds a character's `events` (up to and including `moment`) onto its base kind —
 * everyone starts `baseKind` (human, by default) and stays alive until an event
 * says otherwise. Events are applied oldest-first so the latest one wins. */
export function resolveCharacterState(character: MapCharacter, moment: TimelineMoment): ResolvedCharacterState {
  const cursor = momentOrdinal(moment)
  let kind = character.sheet.baseKind
  let alive = true
  const relevant = character.sheet.events
    .filter(event => eventOrdinal(event) <= cursor)
    .sort(compareDated)
  for (const event of relevant) {
    if (event.kind) kind = event.kind
    if (event.alive !== undefined) alive = event.alive
  }
  return { kind, alive, borderColor: alive ? CHARACTER_KIND_BORDER_COLORS[kind] : DEAD_BORDER_COLOR }
}

/** `null` birth year means "always on the map" — only an explicit birth year in
 * the future (relative to the cursor) hides a character. Birth is tracked by
 * year only; the free-text `birthDateLabel` is display, not ordering. */
export function isCharacterBornAt(character: MapCharacter, moment: TimelineMoment | null): boolean {
  if (moment === null) return true
  const birthYear = character.sheet.birthYear
  if (birthYear === null) return true
  return birthYear <= moment.year
}

/**
 * The moment a relationship's line starts existing: the earliest event marked
 * `appears`. `null` = no appearance date was ever set, which deliberately
 * means "always on the map" (the owner wants the line, just hasn't decided
 * when it began).
 */
export function relationshipStart(relationship: MapRelationship): RelationshipEvent | null {
  const appearances = relationship.events.filter(event => event.appears).sort(compareDated)
  return appearances[0] ?? null
}

export type ResolvedRelationshipState = {
  /** `false` only before the relationship's appearance event. */
  visible: boolean
  label: string
  description: string
  color: string | null
  kind: RelationshipKind
}

/** Folds a relationship's `events` (up to and including `moment`) onto its base
 * label/color/description, and decides whether the line exists yet. A
 * relationship with no appearance event is visible at every moment. */
export function resolveRelationshipState(relationship: MapRelationship, moment: TimelineMoment): ResolvedRelationshipState {
  const cursor = momentOrdinal(moment)
  const start = relationshipStart(relationship)
  let label = relationship.label
  let description = relationship.description
  let color = relationship.color
  const relevant = relationship.events
    .filter(event => eventOrdinal(event) <= cursor)
    .sort(compareDated)
  for (const event of relevant) {
    if (event.label !== undefined) label = event.label
    if (event.color !== undefined) color = event.color
    if (event.description !== undefined) description = event.description
  }
  return {
    visible: start === null || eventOrdinal(start) <= cursor,
    label,
    description,
    color,
    kind: relationship.kind,
  }
}

export type TimelineBounds = { min: number; max: number }

/** `null` when nothing on the map has any timeline data yet — the caller should
 * keep the timeline control hidden and treat the map as timeline-agnostic. */
export function computeTimelineBounds(characters: MapCharacter[], relationships: MapRelationship[]): TimelineBounds | null {
  const years: number[] = []
  for (const character of characters) {
    if (character.sheet.birthYear !== null) years.push(character.sheet.birthYear)
    for (const event of character.sheet.events) years.push(event.year)
  }
  for (const relationship of relationships) {
    for (const event of relationship.events) years.push(event.year)
  }
  if (years.length === 0) return null
  const min = Math.min(...years)
  const max = Math.max(...years)
  return { min, max: min === max ? max + 1 : max }
}

export type TimelineMark = {
  year: number
  /** Cursor position the prev/next stepper jumps to for this mark. */
  moment: TimelineMoment
  /** Sort/dedup key — events sharing a date share a mark. */
  ordinal: number
  label: string
}

/** The cursor position that puts the timeline exactly *at* a dated entry: its
 * own day, or the start of the year when only the year is known. */
export function momentForDate(date: DatedLike): TimelineMoment {
  if (date.month === null) return makeMoment(date.year, 1, 1)
  return makeMoment(date.year, date.month, date.day ?? 1)
}

/** Distinct moments worth stepping to with the timeline's prev/next buttons —
 * every birth and every event, deduplicated by date and sorted. Callers should
 * pass already-localized `characters`/`relationships` (see `localizeCharacter`/
 * `localizeRelationship` in `i18n.ts`) — `language` here only controls the
 * two connector words ("Birth:" / "event") baked into the labels below. */
export function collectTimelineMarks(
  characters: MapCharacter[],
  relationships: MapRelationship[],
  language: MapLanguage = 'ru',
): TimelineMark[] {
  const s = t(language).timelineMarks
  const byOrdinal = new Map<number, TimelineMark>()
  const add = (date: DatedLike, label: string) => {
    const ordinal = eventOrdinal(date)
    const existing = byOrdinal.get(ordinal)
    if (existing) existing.label = `${existing.label}, ${label}`
    else byOrdinal.set(ordinal, { year: date.year, moment: momentForDate(date), ordinal, label })
  }
  for (const character of characters) {
    if (character.sheet.birthYear !== null) {
      add({ year: character.sheet.birthYear, month: null, day: null }, s.birthPrefix(character.name))
    }
    for (const event of character.sheet.events) {
      add(event, s.characterEvent(character.name, event.title || s.eventFallback))
    }
  }
  for (const relationship of relationships) {
    for (const event of relationship.events) add(event, event.title || s.eventFallback)
  }
  return Array.from(byOrdinal.values()).sort((a, b) => a.ordinal - b.ordinal)
}

/** Sorted chronological copy — the one ordering every panel and the export
 * should use, now that events inside one year can carry a date. */
export function sortDated<T extends DatedLike>(items: T[]): T[] {
  return [...items].sort(compareDated)
}

/** Convenience for the character panel: the events of `character` that a given
 * relationship's appearance is bound to. */
export function isEventAppearanceOf(event: CharacterEvent, relationship: MapRelationship): boolean {
  return relationship.events.some(relationshipEvent => relationshipEvent.sourceEventId === event.id)
}
