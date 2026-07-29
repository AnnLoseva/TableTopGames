import type { ActorKind, ActorStatus } from '../types'
import type { NormalizedActor } from '../types'

export const ACTOR_KIND_LABELS: Record<ActorKind, string> = {
  player_character: 'ПК',
  full_npc: 'полный',
  compact_spc: 'SPC',
  ghoul: 'гуль',
  mortal: 'смертный',
  thin_blood: 'тонкая кровь',
  custom: 'custom',
}

export const ACTOR_STATUS_LABELS: Record<ActorStatus, string> = {
  active: 'активен',
  inactive: 'неактивен',
  missing: 'пропал',
  dead: 'мертв',
  archived: 'архив',
}

export function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

export function sheetTypeLabel(actor: Pick<NormalizedActor, 'kind' | 'source' | 'characterId'>): string {
  if (actor.characterId || actor.source === 'linked_character') {
    if (actor.kind === 'player_character') return 'ПК'
    if (actor.kind === 'ghoul') return 'гуль'
    if (actor.kind === 'mortal') return 'смертный'
    return 'полный'
  }
  return ACTOR_KIND_LABELS[actor.kind] || 'SPC'
}

export function willpowerLabel(actor: NormalizedActor): string {
  const { current, max } = actor.vitals.willpower
  return `${current}/${max}`
}

export function dotsString(value: number, max = 5): string {
  const filled = Math.max(0, Math.min(max, Math.round(value)))
  return `${'●'.repeat(filled)}${'○'.repeat(Math.max(0, max - filled))}`
}

export function isHighHunger(hunger: number): boolean {
  return hunger >= 4
}
