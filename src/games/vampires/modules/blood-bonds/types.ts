import type { Module } from '@/platform/hub'
import type { MasterVisibility } from '@/games/vampires/modules/master-console/persistence/types'

export type BloodBondsModule = Module<'blood-bonds', 'vtm5'>

export type BloodBondStatus = 'active' | 'inactive' | 'broken'
export type BloodBondEventType =
  | 'created'
  | 'drink'
  | 'level_up'
  | 'level_down'
  | 'break'
  | 'deactivate'
  | 'reactivate'
  | 'note'
  | 'corrective'

export type BloodBond = {
  id: string
  chronicleId: string
  room: string
  thrallActorId: string
  regnantActorId: string
  level: number
  drinksCount: number
  firstDrinkAt: string | null
  lastDrinkAt: string | null
  expiresAt: string | null
  status: BloodBondStatus
  visibility: MasterVisibility
  notes: string
  createdAt: string
  updatedAt: string
}

export type BloodBondEvent = {
  id: string
  bondId: string
  chronicleId: string
  room: string
  eventType: BloodBondEventType
  previousLevel: number | null
  newLevel: number | null
  occurredAt: string
  sessionId: string | null
  note: string
  createdBy: string
  createdAt: string
}

export type BloodBondRow = {
  id: string
  chronicle_id: string
  room: string
  thrall_actor_id: string
  regnant_actor_id: string
  level: number
  drinks_count: number
  first_drink_at: string | null
  last_drink_at: string | null
  expires_at: string | null
  status: BloodBondStatus
  visibility: MasterVisibility
  notes: string
  created_at: string
  updated_at: string
}

export type BloodBondEventRow = {
  id: string
  bond_id: string
  chronicle_id: string
  room: string
  event_type: BloodBondEventType
  previous_level: number | null
  new_level: number | null
  occurred_at: string
  session_id: string | null
  note: string
  created_by: string
  created_at: string
}

export type GraphNode = {
  id: string
  label: string
  isPc: boolean
  x: number
  y: number
}

export type GraphEdge = {
  id: string
  bondId: string
  source: string
  target: string
  level: number
  status: BloodBondStatus
}

export type BondListRow = {
  bond: BloodBond
  thrallName: string
  regnantName: string
  warning: string
  levelTitle: string
}
