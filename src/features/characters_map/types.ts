export type RelationshipKind = 'directed' | 'mutual'

export type MapCharacter = {
  id: string
  name: string
  description: string
  imagePath: string | null
  positionX: number
  positionY: number
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
  created_at: string
  updated_at: string
}

export type MapCharacterInput = {
  name: string
  description: string
  imagePath?: string | null
  positionX?: number
  positionY?: number
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
