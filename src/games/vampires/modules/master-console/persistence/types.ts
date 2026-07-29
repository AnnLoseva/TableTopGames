export type ChronicleRole = 'master' | 'observer' | 'player'
export type MasterVisibility = 'master' | 'shared'
export type ChronicleSessionStatus = 'planned' | 'active' | 'ended' | 'archived'
export type JsonObject = Record<string, unknown>

export type Chronicle = {
  id: string
  room: string
  name: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ChronicleMembership = {
  chronicleId: string
  userId: string
  role: ChronicleRole
  createdAt: string
}

export type ChronicleSession = {
  id: string
  chronicleId: string
  room: string
  sequenceNumber: number
  nightNumber: number
  title: string
  status: ChronicleSessionStatus
  startedAt: string | null
  endedAt: string | null
  publicSummary: string
  privateSummary: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type MasterLayout = {
  id: string
  chronicleId: string
  room: string
  ownerId: string
  name: string
  layoutVersion: number
  layoutJson: JsonObject
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type MasterMacro = {
  id: string
  chronicleId: string
  room: string
  ownerId: string | null
  title: string
  actionType: string
  shortcut: string | null
  config: JsonObject
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type ChronicleEntityLink = {
  id: string
  chronicleId: string
  room: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  relationType: string
  label: string
  visibility: MasterVisibility
  metadata: JsonObject
  createdAt: string
}

export type MasterActionLogEntry = {
  id: string
  chronicleId: string
  room: string
  sessionId: string | null
  actionType: string
  actorType: string
  actorId: string
  summary: string
  payload: JsonObject
  inversePayload: JsonObject | null
  visibility: MasterVisibility
  createdBy: string
  revertedAt: string | null
  createdAt: string
}

export type MasterLayoutRow = {
  id: string
  chronicle_id: string
  room: string
  owner_id: string
  name: string
  layout_version: number
  layout_json: unknown
  is_default: boolean
  created_at: string
  updated_at: string
}

export type MasterActionLogRow = {
  id: string
  chronicle_id: string
  room: string
  session_id: string | null
  action_type: string
  actor_type: string
  actor_id: string
  summary: string
  payload: unknown
  inverse_payload: unknown
  visibility: MasterVisibility
  created_by: string
  reverted_at: string | null
  created_at: string
}

export type ChronicleSessionRow = {
  id: string
  chronicle_id: string
  room: string
  sequence_number: number
  night_number: number
  title: string
  status: ChronicleSessionStatus
  started_at: string | null
  ended_at: string | null
  public_summary: string
  private_summary: string
  created_by: string
  created_at: string
  updated_at: string
}

export type MasterMacroRow = {
  id: string
  chronicle_id: string
  room: string
  owner_id: string | null
  title: string
  action_type: string
  shortcut: string | null
  config: unknown
  sort_order: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export type ChronicleEntityLinkRow = {
  id: string
  chronicle_id: string
  room: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  relation_type: string
  label: string
  visibility: MasterVisibility
  metadata: unknown
  created_at: string
}
