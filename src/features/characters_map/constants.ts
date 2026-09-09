export const CHARACTERS_MAP_CHARACTERS_TABLE = 'characters_map_characters'
export const CHARACTERS_MAP_RELATIONSHIPS_TABLE = 'characters_map_relationships'
export const CHARACTERS_MAP_IMAGES_BUCKET = 'characters-map-images'

// Mirrors DND_JOURNAL_OWNER_AUTH_USER_ID: the shared TableTopGames account
// ("Anna") is the only writer, enforced by RLS in supabase/characters_map.sql.
export const CHARACTERS_MAP_OWNER_AUTH_USER_ID = '44153f98-aaf2-4935-b7b2-45fe3155edc6'

export const CHARACTER_NAME_MAX_LENGTH = 200
export const CHARACTER_DESCRIPTION_MAX_LENGTH = 10000
export const RELATIONSHIP_LABEL_MAX_LENGTH = 100
export const RELATIONSHIP_DESCRIPTION_MAX_LENGTH = 10000

export const DEFAULT_RELATIONSHIP_COLOR = '#c9a961'
