import type { Module } from '@/platform/hub'
import type { MasterActor } from '@/games/vampires/modules/actors/types'
import type { RollMessage, RollMode } from '@/games/vampires/modules/table/types'

export type MasterRollsModule = Module<'master-rolls', 'vtm5'>

export type MasterRollBuilderState = {
  actorId: string | null
  attribute: string
  attributeTwo: string
  skill: string
  discipline: string
  modifier: number
  difficulty: number
  mode: RollMode
  opponentActorId: string | null
  hidden: boolean
  useBloodSurge: boolean
}

export type MasterRollPoolPreview = {
  dice: number
  normalDice: number
  hungerDice: number
  poolName: string
  traits: string[]
  bloodSurgeBonus: number
  hunger: number
  warnings: string[]
}

export type MasterRollConsequence =
  | 'bestial_failure'
  | 'messy_critical'
  | 'failure'
  | 'critical_success'
  | 'max_hunger'
  | 'failed_rouse'

export type MasterRollConsequenceAction = {
  id: string
  consequence: MasterRollConsequence
  label: string
  rollId: string
  actorId: string | null
}

/** Inverse ops for action-log undo — never full state snapshots. */
export type MasterInverseOperation =
  | { type: 'restore_actor_hunger'; actorId: string; hunger: number }
  | { type: 'delete_hidden_roll'; rollId: string }
  | { type: 'noop' }

export type MasterHiddenRollRow = {
  id: string
  chronicle_id: string
  room: string
  roll_json: unknown
  revealed_at: string | null
  revealed_public_roll_id: string | null
  created_by: string
  created_at: string
}

export type PublishMasterRollResult = {
  roll: RollMessage
  storage: 'public' | 'hidden' | 'local'
}

export type MasterRollContext = {
  room: string
  chronicleId: string
  actors: readonly MasterActor[]
}
