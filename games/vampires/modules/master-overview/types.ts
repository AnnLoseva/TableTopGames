import type { Module } from '@/core/hub'
import type { MasterActor, NormalizedActor } from '@/games/vampires/modules/actors/types'
import type { MasterActionLogEntry, MasterVisibility } from '@/games/vampires/modules/master-console/persistence/types'

export type MasterOverviewModule = Module<'master-overview', 'vtm5'>

export type PlotHeat = 'background' | 'smoldering' | 'boiling' | 'critical'
export type PlotStatus = 'active' | 'resolved' | 'archived'
export type NotesSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'local'

export type SessionNote = {
  id: string
  chronicleId: string
  room: string
  sessionId: string | null
  title: string
  bodyHtml: string
  entityType: string
  entityId: string
  visibility: MasterVisibility
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type PlotHook = {
  id: string
  chronicleId: string
  room: string
  title: string
  nextStep: string
  heat: PlotHeat
  status: PlotStatus
  relatedActorIds: string[]
  relatedLocationIds: string[]
  relatedSessionIds: string[]
  loreEntryId: string
  sortOrder: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type SessionNoteRow = {
  id: string
  chronicle_id: string
  room: string
  session_id: string | null
  title: string
  body_html: string
  entity_type: string
  entity_id: string
  visibility: MasterVisibility
  created_by: string
  created_at: string
  updated_at: string
}

export type PlotHookRow = {
  id: string
  chronicle_id: string
  room: string
  title: string
  next_step: string
  heat: PlotHeat
  status: PlotStatus
  related_actor_ids: string[] | null
  related_location_ids: string[] | null
  related_session_ids: string[] | null
  lore_entry_id: string
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

/** Read model for a PC card — points back to actor/character ids, no duplicated sheet. */
export type CoterieMemberCard = {
  actorId: string
  characterId: string | null
  displayName: string
  playerName: string
  portraitUrl: string
  hunger: number
  healthCurrent: number
  healthMax: number
  willpowerCurrent: number
  willpowerMax: number
  humanity: number
  stains: number
  touchstones: readonly string[]
  warnings: readonly string[]
  critical: boolean
  status: MasterActor['status']
}

export type CoterieSummary = {
  members: CoterieMemberCard[]
  averageHunger: number | null
  highHungerCount: number
  criticalCount: number
  sharedAnchors: string[]
  openConsequenceCount: number
}

export type SceneNpcCard = {
  actorId: string
  characterId: string | null
  displayName: string
  portraitUrl: string
  bloodPotency: number
  hunger: number
  role: string
  status: MasterActor['status']
  kind: MasterActor['kind']
  hiddenSecrets: boolean
  poolDice: number
}

export type TimelineItem = {
  id: string
  at: string
  kind: 'roll' | 'macro' | 'hunger' | 'stain' | 'scene' | 'secret' | 'manual' | 'consequence' | 'action'
  title: string
  detail: string
  consequence?: string
  hidden: boolean
  sourceType: string
  sourceId: string
  href?: string
}

export type OverviewMacroId =
  | 'rouse_selected'
  | 'frenzy_selected'
  | 'coterie_hunger_plus'
  | 'blood_surge'
  | 'downtime'
  | 'random_complication'

export type OverviewMacro = {
  id: OverviewMacroId
  title: string
  shortcut?: string
  dangerous: boolean
}

export type OverviewModel = {
  coterie: CoterieSummary
  sceneNpcs: SceneNpcCard[]
  activeSceneId: string | null
  activeSceneName: string | null
  plots: PlotHook[]
  timeline: TimelineItem[]
  actorsById: ReadonlyMap<string, MasterActor>
  normalizedById: ReadonlyMap<string, NormalizedActor>
  actionLog: readonly MasterActionLogEntry[]
}
