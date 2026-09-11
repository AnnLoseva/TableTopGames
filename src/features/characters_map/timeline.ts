import { CHARACTER_KIND_BORDER_COLORS, DEAD_BORDER_COLOR } from './constants'
import { t, type MapLanguage } from './i18n'
import type { CharacterKind, MapCharacter, MapRelationship, RelationshipKind } from './types'

export type ResolvedCharacterState = {
  kind: CharacterKind
  alive: boolean
  borderColor: string
}

/** Folds a character's `events` (up to and including `year`) onto its base kind —
 * everyone starts `baseKind` (human, by default) and stays alive until an event
 * says otherwise. Events are applied oldest-first so the latest one wins. */
export function resolveCharacterState(character: MapCharacter, year: number): ResolvedCharacterState {
  let kind = character.sheet.baseKind
  let alive = true
  const relevant = character.sheet.events
    .filter(event => event.year <= year)
    .sort((a, b) => a.year - b.year)
  for (const event of relevant) {
    if (event.kind) kind = event.kind
    if (event.alive !== undefined) alive = event.alive
  }
  return { kind, alive, borderColor: alive ? CHARACTER_KIND_BORDER_COLORS[kind] : DEAD_BORDER_COLOR }
}

/** `null` birth year means "always on the map" — only an explicit birth year in
 * the future (relative to `year`) hides a character. */
export function isCharacterBornAt(character: MapCharacter, year: number | null): boolean {
  if (year === null) return true
  const birthYear = character.sheet.birthYear
  if (birthYear === null) return true
  return birthYear <= year
}

export type ResolvedRelationshipState = {
  active: boolean
  label: string
  description: string
  color: string | null
  kind: RelationshipKind
}

/** Folds a relationship's `events` (up to and including `year`) onto its base
 * label/color/description/active state. `active` defaults to true so a
 * relationship with no events behaves exactly as it did before this feature. */
export function resolveRelationshipState(relationship: MapRelationship, year: number): ResolvedRelationshipState {
  let active = true
  let label = relationship.label
  let description = relationship.description
  let color = relationship.color
  const relevant = relationship.events
    .filter(event => event.year <= year)
    .sort((a, b) => a.year - b.year)
  for (const event of relevant) {
    if (event.active !== undefined) active = event.active
    if (event.label !== undefined) label = event.label
    if (event.color !== undefined) color = event.color
    if (event.description !== undefined) description = event.description
  }
  return { active, label, description, color, kind: relationship.kind }
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

export type TimelineMark = { year: number; label: string }

/** Distinct years worth stepping to with the timeline's prev/next buttons —
 * every birth and every event, deduplicated and sorted. Callers should pass
 * already-localized `characters`/`relationships` (see `localizeCharacter`/
 * `localizeRelationship` in `i18n.ts`) — `language` here only controls the
 * two connector words ("Birth:" / "event") baked into the labels below. */
export function collectTimelineMarks(
  characters: MapCharacter[],
  relationships: MapRelationship[],
  language: MapLanguage = 'ru',
): TimelineMark[] {
  const s = t(language).timelineMarks
  const byYear = new Map<number, string[]>()
  const add = (year: number, label: string) => {
    const existing = byYear.get(year)
    if (existing) existing.push(label)
    else byYear.set(year, [label])
  }
  for (const character of characters) {
    if (character.sheet.birthYear !== null) add(character.sheet.birthYear, s.birthPrefix(character.name))
    for (const event of character.sheet.events) add(event.year, s.characterEvent(character.name, event.title || s.eventFallback))
  }
  for (const relationship of relationships) {
    for (const event of relationship.events) add(event.year, event.title || s.eventFallback)
  }
  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, labels]) => ({ year, label: labels.join(', ') }))
}
