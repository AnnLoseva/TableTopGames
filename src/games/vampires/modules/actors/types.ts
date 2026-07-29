import type { Module } from '@/platform/hub'
import type { CharacterOption, CharacterRow } from '@/games/vampires/modules/table/types'
import type { VtmActorDisplayVitals, VtmActorKind, VtmActorMechanicsInput } from '@/games/vampires/core/vtm5/adapters/actors'

export type ActorsModule = Module<'actors', 'vtm5'>
export type ActorKind = VtmActorKind
export type ActorStatus = 'active' | 'inactive' | 'missing' | 'dead' | 'archived'
export type CompactActorStats = Omit<VtmActorMechanicsInput, 'kind'> & {
  clan?: string
}

export type ActorPrivateFields = {
  secrets: string
  motivation: string
  plans: string
  notes: string
  privateData: Record<string, unknown>
}

export type ChronicleActor = {
  id: string
  chronicleId: string
  room: string
  kind: ActorKind
  characterId: string | null
  name: string
  faction: string
  actorRole: string
  status: ActorStatus
  tags: string[]
  currentSceneId: string | null
  compactStats: CompactActorStats
  imageUrl: string
  manualOverrides: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type MasterActor = ChronicleActor & {
  privateFields: ActorPrivateFields | null
  linkedCharacter: CharacterOption | null
}

export type NormalizedActor = ChronicleActor & {
  source: 'linked_character' | 'compact'
  displayName: string
  displayImage: string
  clan: string
  mechanics: VtmActorMechanicsInput
  vitals: VtmActorDisplayVitals
  linkedCharacter: CharacterOption | null
}

export type ActorPublicPayload = Pick<NormalizedActor,
  | 'id'
  | 'chronicleId'
  | 'room'
  | 'kind'
  | 'characterId'
  | 'faction'
  | 'actorRole'
  | 'status'
  | 'tags'
  | 'currentSceneId'
  | 'source'
  | 'displayName'
  | 'displayImage'
  | 'clan'
  | 'mechanics'
  | 'vitals'
  | 'updatedAt'
>

export type CharacterConversionDraft = Pick<CharacterRow, 'name' | 'clan' | 'data'>

export type ChronicleActorRow = {
  id: string
  chronicle_id: string
  room: string
  kind: ActorKind
  character_id: string | null
  name: string
  faction: string
  actor_role: string
  status: ActorStatus
  tags: string[]
  current_scene_id: string | null
  compact_stats: unknown
  image_url: string
  manual_overrides: unknown
  created_by: string
  created_at: string
  updated_at: string
}

export type ActorPrivateRow = {
  actor_id: string
  chronicle_id: string
  room: string
  secrets: string
  motivation: string
  plans: string
  notes: string
  private_data: unknown
  created_at: string
  updated_at: string
}

export type ActorBulkPatch = Partial<Pick<ChronicleActor,
  | 'faction'
  | 'actorRole'
  | 'status'
  | 'tags'
  | 'currentSceneId'
  | 'compactStats'
  | 'imageUrl'
  | 'manualOverrides'
>>

export type CreateCompactActorInput = Pick<ChronicleActor,
  | 'chronicleId'
  | 'room'
  | 'kind'
  | 'name'
  | 'faction'
  | 'actorRole'
  | 'status'
  | 'tags'
  | 'currentSceneId'
  | 'compactStats'
  | 'imageUrl'
  | 'manualOverrides'
> & {
  privateFields?: ActorPrivateFields
}

/** Combined list filters — all fields AND together when set. */
export type ActorListFilter = {
  query: string
  sceneScope: 'all' | 'in_scene' | 'not_in_scene'
  faction: string | null
  clan: string | null
  kind: ActorKind | null
  status: ActorStatus | null
  tag: string | null
}

export type ActorSortKey =
  | 'name'
  | 'faction'
  | 'status'
  | 'kind'
  | 'hunger'
  | 'bloodPotency'
  | 'willpower'
  | 'actorRole'

export type ActorSortDir = 'asc' | 'desc'

export type SavedActorFilter = {
  id: string
  name: string
  filter: ActorListFilter
}

/**
 * Typed bulk actions for the master NPC list.
 * Dangerous actions must confirm in UI and append master_action_log.
 */
export type ActorBulkAction =
  | { type: 'add_to_scene'; sceneId: string }
  | { type: 'remove_from_scene' }
  | { type: 'increment_hunger'; delta: number }
  | { type: 'set_faction'; faction: string }
  | { type: 'set_status'; status: ActorStatus }
  | { type: 'add_tag'; tag: string }
  | { type: 'clone' }
  | { type: 'archive' }

export type ActorTemplateId =
  | 'sheriff'
  | 'street_ghoul'
  | 'si_hunter'
  | 'mortal'
  | 'custom'

/** Data-driven create templates — never branch JSX per template id. */
export type ActorTemplate = {
  id: ActorTemplateId
  label: string
  kind: ActorKind
  actorRole: string
  faction: string
  status: ActorStatus
  tags: readonly string[]
  compactStats: CompactActorStats
  privateFields?: Partial<ActorPrivateFields>
}

export type ActorQuickAction =
  | 'open_roller'
  | 'rouse_check'
  | 'open_brief'
  | 'open_full_sheet'
  | 'add_to_scene'
  | 'remove_from_scene'
  | 'clone'
  | 'set_hunger'
  | 'archive'
