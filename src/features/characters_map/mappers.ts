import { normalizeRelationshipEvent, withSheetDefaults } from './constants'
import type {
  CharacterSheet,
  CharacterTranslation,
  MapCharacter,
  MapCharacterRow,
  MapRelationship,
  MapRelationshipRow,
  RelationshipEvent,
  RelationshipKind,
  RelationshipTranslation,
} from './types'

export function mapCharacterRow(row: MapCharacterRow): MapCharacter {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imagePath: row.image_path,
    positionX: row.position_x,
    positionY: row.position_y,
    sheet: withSheetDefaults(row.sheet as Partial<CharacterSheet> | null | undefined),
    translationEn: (row.translation_en as CharacterTranslation | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asRelationshipKind(value: string): RelationshipKind {
  return value === 'mutual' ? 'mutual' : 'directed'
}

export function mapRelationshipRow(row: MapRelationshipRow): MapRelationship {
  return {
    id: row.id,
    fromCharacterId: row.from_character_id,
    toCharacterId: row.to_character_id,
    kind: asRelationshipKind(row.kind),
    label: row.label,
    description: row.description,
    color: row.color,
    sortOrder: row.sort_order,
    events: Array.isArray(row.events) ? (row.events as RelationshipEvent[]).map(normalizeRelationshipEvent) : [],
    translationEn: (row.translation_en as RelationshipTranslation | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
