import type { Module } from '@/platform/hub'
import type { Conviction, HumanityStainEvent, HumanityState, HumanityStatus, MoralityState, Touchstone } from '@/games/vampires/core/vtm5/rules/humanity'
import type { NormalizedDisciplinePathPowers, NormalizedDisciplinePowers, NormalizedDisciplines } from '@/games/vampires/core/vtm5/rules/disciplines/character-disciplines'
import type { CharacterDerivedStats } from '@/games/vampires/core/vtm5/rules/derived-stats'
import type { ActiveEffect } from '@/games/vampires/core/vtm5/rules/disciplines/schema'
import type { AppliedDisciplineRollModifier } from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type { AppliedDisciplineDamageModifier } from '@/games/vampires/core/vtm5/rules/damage'
export type { ChatMessage, ChatMessageRow, ChatPanelTab, ChatUser } from '@/games/vampires/modules/chat/types'

export type Die = {
  id?: string
  value: number
  kind: 'fail' | 'success' | 'critical' | 'botch' | 'hunger-fail' | 'hunger-success' | 'hunger-critical-success' | 'hunger-critical-fail'
  rerolled?: boolean
}

export type OpposedRollSide = {
  id: 'left' | 'right'
  actorName: string
  actorKind: 'player' | 'npc'
  poolName: string
  diceCount: number
  dice: Die[]
  successes: number
}

export type OpposedRollResult = {
  sides: [OpposedRollSide, OpposedRollSide]
  winnerSideId: 'left' | 'right' | null
  outcome: 'left' | 'right' | 'tie'
  summary: string
}

export type OpposedRollProposal = {
  id: string
  room: string
  fromUserId: string
  fromUsername: string
  toUserId: string
  createdAt: string
  initiator: OpposedRollSide
}

export type RollPoolBuilder = {
  attribute: string
  attributeTwo: string
  skill: string
  discipline: string
  modifier: number
}

export type OpposedResponsePoolView = {
  diceCount: number
  extraAttributes: string[]
  extraSkills: string[]
  disciplineNames: string[]
}

export type WillpowerRerollDraft = {
  rollId: string
  selectedDieIds: string[]
}

export type RollMode = 'normal' | 'contested'

export type RouseCheckResult = {
  id: string
  reason: string
  value: number
  success: boolean
  hungerBefore: number
  hungerAfter: number
  maxHungerWarning?: boolean
}

export type WillpowerTracker = {
  superficial: number
  aggravated: number
}

export type NormalizedWillpower = WillpowerTracker & {
  max: number
  current: number
  impaired: boolean
}

export type HealthTracker = {
  superficial: number
  aggravated: number
  bonusMax?: number
  maxOverride?: number | null
}

export type NormalizedHealth = HealthTracker & {
  bonusMax: number
  maxOverride: number | null
  max: number
  current: number
  impaired: boolean
  defeated: boolean
  physicalState: 'healthy' | 'impaired' | 'torpor' | 'dead_or_coma' | 'dead' | null
}

export type VitalTrackers = {
  health?: number | HealthTracker
  willpower?: number | WillpowerTracker
  humanity?: number
  hunger?: number
}

export type WillpowerMetaState = {
  max: number
  superficial: number
  aggravated: number
  current: number
}

export type HealthMetaState = {
  max: number
  superficial: number
  aggravated: number
  current: number
  impaired: boolean
  physicalState?: NormalizedHealth['physicalState']
}

export type HumanityRollMeta = {
  humanityBefore?: number
  humanityAfter?: number
  stainsBefore?: number
  stainsAfter?: number
  remorseDice?: number
  automaticFailure?: boolean
  humanityLost?: boolean
  stainEvents?: HumanityStainEvent[]
}

export type RollMeta = {
  characterId?: string
  rollKind?: 'humanity_check' | 'remorse_check'
  rollMode?: RollMode
  contested?: {
    requestId?: string
    initiatorCharacterId?: string
    initiatorCharacterName?: string
    initiatorPoolName?: string
    initiatorDiceCount?: number
    opponentUserId?: string
    opponentCharacterId?: string
    opponentName?: string
    status?: 'requested' | 'answered' | 'resolved' | 'cancelled'
    initiatorSuccesses?: number
    opponentSuccesses?: number
    margin?: number
    winner?: 'initiator' | 'opponent' | 'tie'
  }
  hungerBefore?: number
  hungerAfter?: number
  hungerDice?: number
  bloodPotency?: number
  rouseChecks?: RouseCheckResult[]
  bloodSurge?: {
    enabled: boolean
    bonusDice: number
  }
  willpowerBefore?: WillpowerMetaState
  willpowerAfter?: WillpowerMetaState
  spentWillpower?: number
  recoveredWillpower?: number
  willpowerReroll?: {
    used: boolean
    selectedDieIds: string[]
    oldDice: Die[]
    newDice: Die[]
  }
  willpowerImpaired?: boolean
  impairmentPenaltyApplied?: number
  healthBefore?: HealthMetaState
  healthAfter?: HealthMetaState
  healthImpaired?: boolean
  healthImpairmentPenaltyApplied?: number
  physicalState?: NormalizedHealth['physicalState']
  rollModifiers?: AppliedDisciplineRollModifier[]
  rollDifficultyModifier?: number
  humanityBefore?: number
  humanityAfter?: number
  stainsBefore?: number
  stainsAfter?: number
  remorseDice?: number
  automaticFailure?: boolean
  humanityLost?: boolean
  stainEvents?: HumanityStainEvent[]
  damage?: {
    source: string
    originalAmount: number
    finalAmount: number
    severity: 'superficial' | 'aggravated'
    halved: boolean
    amountBeforeHalving?: number
    originalSeverity?: 'superficial' | 'aggravated'
    prevented?: boolean
    armorIgnored?: boolean
    armorValue?: number
    modifiers?: AppliedDisciplineDamageModifier[]
    chain?: string[]
    weaponModifier?: number
    margin?: number
    targetCharacterId?: string
    targetCharacterName?: string
  }
  healing?: {
    type: 'vampire_superficial' | 'vampire_aggravated' | 'mortal_superficial' | 'mortal_aggravated_medicine' | 'manual'
    amountSuperficial?: number
    amountAggravated?: number
    rouseChecks?: RouseCheckResult[]
  }
  messyCritical?: boolean
  bestialFailure?: boolean
  source?: 'manual' | 'discipline' | 'blood_surge' | 'rouse_check' | 'character_sheet' | 'willpower' | 'health' | 'physical_conflict' | 'humanity'
  warnings?: string[]
  discipline?: {
    name: string
    power: string
    level: number
    cost: string
  }
}

export type RollMessage = {
  id: string
  room: string
  characterName: string
  poolName: string
  poolType: string
  diceCount: number
  dice: Die[]
  successes: number
  createdAt: string
  hidden?: boolean
  opposed?: OpposedRollResult
  meta?: RollMeta
}

export type RollRow = {
  id: string
  room: string
  character_name: string
  pool_name: string
  pool_type: string
  dice_count: number
  dice: unknown
  successes: number
  meta?: unknown
  created_at: string
}

export type CharacterType = 'vampire' | 'mortal' | 'ghoul' | 'thinblood'

export type CharacterHumanity = HumanityState & {
  freeBoxes: number
  status: HumanityStatus
}

export type CharacterOption = {
  id: string
  name: string
  clan: string | null
  image: string
  hydrated?: boolean
  username?: string
  userId?: string
  concept?: string
  predator?: string
  generation?: string
  type?: string
  characterType: CharacterType
  bloodPotency?: number
  humanity?: CharacterHumanity
  morality?: MoralityState
  health?: NormalizedHealth
  willpower?: NormalizedWillpower
  damageProfile?: 'vampire' | 'mortal' | 'ghoul' | 'thinblood' | 'custom'
  physicalState?: NormalizedHealth['physicalState']
  lastAggravatedMendAt?: string
  sheetFixed?: boolean
  notes?: string
  appearance?: string
  backstory?: string
  freeExp?: number
  vitalTrackers?: VitalTrackers
  inventory: InventoryItem[]
  attributes: Record<string, number>
  skills: Record<string, number | { dots?: number; specs?: string[] }>
  disciplines: NormalizedDisciplines
  selectedPowers: NormalizedDisciplinePowers
  selectedPathPowers: NormalizedDisciplinePathPowers
  derivedStats: CharacterDerivedStats
  activeEffects: ActiveEffect[]
}

export type CharacterRow = {
  id: string
  user_id?: string | null
  users?: { username?: string | null } | null
  name: string
  clan: string | null
  data: {
    characterImage?: string
    image?: string
    portrait?: string
    concept?: string
    predator?: string
    generation?: string
    type?: string
    characterType?: CharacterType
    creatureType?: CharacterType
    kind?: CharacterType
    sheetMode?: string
    hasBeenSaved?: boolean
    bloodPotency?: number
    baseHumanity?: string | number
    humanity?: number | (Partial<HumanityState> & { base?: number })
    sheetFixed?: boolean
    creationCompleted?: boolean
    blood?: {
      potency?: number
    }
    damageProfile?: CharacterOption['damageProfile']
    status?: {
      physicalState?: NormalizedHealth['physicalState']
      humanityState?: 'lost_to_beast'
    }
    healthState?: {
      lastAggravatedMendAt?: string
    }
    sheetLock?: {
      fixed?: boolean
    }
    notes?: string
    appearance?: string
    backstory?: string
    freeExp?: number
    experience?: number
    vitalTrackers?: VitalTrackers
    inventory?: InventoryItem[]
    morality?: {
      chronicleTenets?: string[]
      convictions?: Array<string | Partial<Conviction>>
      touchstones?: Array<string | Partial<Touchstone>>
    }
    touchstones?: Array<string | { text?: string; name?: string; image?: string }>
    attributes?: Record<string, number>
    skills?: Record<string, number | { dots?: number; specs?: string[] }>
    disciplines?: unknown
    selectedPowers?: unknown
    powers?: unknown
    activeEffects?: unknown
  } | null
}

export type InventoryItem = {
  id: string
  name: string
  description: string
  quantity: number
  category: string
  note: string
  createdAt: string
  updatedAt: string
  collapsed?: boolean
}

export type ActiveParticipant = {
  userId: string
  username: string
  characterId: string | null
  characterName: string
  characterClan: string | null
  characterImage: string
  updatedAt: string
}

export type JournalEntry = {
  id: string
  title: string
  text: string
  updatedAt: string
  createdAt: string
  attachments?: JournalAttachment[]
}

export type JournalAttachment = {
  id: string
  kind: 'image' | 'link'
  url: string
  title: string
  createdAt: string
}

export type MasterReveal = {
  id: string
  room: string
  kind: string
  title: string
  body: string
  meta: string
  characterName: string
  userId: string
  username: string
  createdAt: string
}

export type MasterWhisper = {
  id: string
  room: string
  fromUserId: string
  fromUsername: string
  toUserId: string | null
  message: string
  fromMaster: boolean
  createdAt: string
}

export type VoiceQuality = 'low' | 'medium' | 'high' | 'studio'

/** @deprecated Legacy preset — migrated to `high` on load */
export type LegacyVoiceQuality = 'balanced' | 'clear'

export type VoiceNoiseSuppression = 'off' | 'light' | 'aggressive'

export type VoiceDeviceInfo = {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export type VoiceSettings = {
  quality: VoiceQuality
  noiseSuppression: VoiceNoiseSuppression
  inputDeviceId: string | null
  outputDeviceId: string | null
  masterVolume: number
}

export type VoiceConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown'

export type VoiceParticipant = {
  id: string
  username: string
  characterName: string
  characterImage: string
  volume: number
  muted: boolean
  connected: boolean
  speaking?: boolean
  connectionQuality?: VoiceConnectionQuality
}

export type VoiceSignal = {
  type: 'join' | 'offer' | 'answer' | 'ice' | 'leave' | 'mute' | 'speaking' | 'device-change'
  room: string
  from: string
  to?: string
  username?: string
  characterName?: string
  characterImage?: string
  muted?: boolean
  speaking?: boolean
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export type TableLayer = {
  id: string
  room: string
  sceneId: string | null
  layerType: 'image' | 'video' | 'folder' | 'text' | 'file'
  ownerRole: TableRole
  ownerId: string | null
  parentId: string | null
  name: string
  imageData: string
  x: number
  y: number
  width: number
  height: number
  cropX: number | null
  cropY: number | null
  cropWidth: number | null
  cropHeight: number | null
  zIndex: number
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
  onTable: boolean
  /** Flagged as a background candidate for its scene; shows in the Layers-tab "Фон" group. */
  isBackground: boolean
  createdAt: string
}

export type TableLayerRow = {
  id: string
  room: string
  scene_id?: string | null
  layer_type: 'image' | 'video' | 'folder' | 'text' | 'file' | null
  owner_role: TableRole | null
  owner_id?: string | null
  parent_id: string | null
  name: string
  image_data: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  crop_x?: number | null
  crop_y?: number | null
  crop_width?: number | null
  crop_height?: number | null
  z_index: number | null
  visible: boolean | null
  locked: boolean | null
  opacity?: number | null
  blend_mode?: BlendMode | null
  rotation?: number | null
  flip_x?: boolean | null
  flip_y?: boolean | null
  brightness?: number | null
  contrast?: number | null
  saturation?: number | null
  on_table?: boolean | null
  is_background?: boolean | null
  created_at: string
}

export type TableRole = 'master' | 'player'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'luminosity'

export type LayerPatch = Partial<Pick<TableLayer, 'sceneId' | 'layerType' | 'ownerRole' | 'ownerId' | 'parentId' | 'name' | 'imageData' | 'x' | 'y' | 'width' | 'height' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight' | 'zIndex' | 'visible' | 'locked' | 'opacity' | 'blendMode' | 'rotation' | 'flipX' | 'flipY' | 'brightness' | 'contrast' | 'saturation' | 'onTable' | 'isBackground'>>

export type ImageEditorState = {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
}

export type ImageEditorDraft = {
  layerId: string
  state: ImageEditorState
  history: ImageEditorState[]
  future: ImageEditorState[]
  aspectLocked: boolean
  drag: null | {
    handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'
    startX: number
    startY: number
    initial: ImageEditorState
  }
}

export type TableScene = {
  id: string
  room: string
  name: string
  thumbnailUrl: string
  isActive: boolean
  /** Scene background image URL; empty string = no background (default stage). */
  backgroundUrl: string
  /** Stage size in scene units; follows the background image's natural size. */
  width: number
  height: number
  /** Optional session folder this scene belongs to; null = ungrouped. */
  folderId: string | null
  /** 'table' clamps player pan/zoom to the stage; 'free' lets players pan anywhere. */
  viewMode: 'table' | 'free'
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type TableSceneRow = {
  id: string
  room: string
  name: string
  thumbnail_url: string | null
  is_active: boolean | null
  background_url?: string | null
  width?: number | null
  height?: number | null
  folder_id?: string | null
  view_mode?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Scene folder ("session"): groups table_scenes rows for one game night. */
export type TableSceneFolder = {
  id: string
  room: string
  name: string
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export type TableSceneFolderRow = {
  id: string
  room: string
  name: string
  order_index: number | null
  created_at: string
  updated_at: string
}

/** Character token: a canvas object linked to a character, always above media layers. */
export type CharacterToken = {
  id: string
  room: string
  sceneId: string
  characterId: string
  characterName: string
  imageUrl: string
  ownerUserId: string | null
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  createdAt: string
  updatedAt: string
}

export type CharacterTokenRow = {
  id: string
  room: string
  scene_id: string
  character_id: string
  character_name: string | null
  image_url: string | null
  owner_user_id: string | null
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  z_index: number | null
  created_at: string
  updated_at: string
}

export type TokenPatch = Partial<Pick<CharacterToken, 'sceneId' | 'characterName' | 'imageUrl' | 'ownerUserId' | 'x' | 'y' | 'width' | 'height' | 'zIndex'>>

/** Assignment "user controls character" — one player may control several characters. */
export type CharacterController = {
  id: string
  room: string
  characterId: string
  userId: string
  canMoveToken: boolean
  canOpenSheet: boolean
  canRollDice: boolean
  canResizeToken: boolean
  createdAt: string
}

export type CharacterControllerRow = {
  id: string
  room: string
  character_id: string
  user_id: string
  can_move_token: boolean | null
  can_open_sheet: boolean | null
  can_roll_dice: boolean | null
  can_resize_token: boolean | null
  created_at: string
}

export type SceneMusicTrack = {
  id: string
  room: string
  sceneId: string
  title: string
  url: string
  sourceType: string
  orderIndex: number
  isDefault: boolean
  autoplay: boolean
  createdAt: string
  updatedAt: string
}

export type SceneMusicRow = {
  id: string
  room: string
  scene_id: string
  title: string
  url: string
  source_type: string | null
  order_index: number | null
  is_default: boolean | null
  autoplay: boolean | null
  created_at: string
  updated_at: string
}

export type DragState = {
  id: string
  mode: 'move' | 'resize' | 'pan' | 'select'
  corner?: 'nw' | 'ne' | 'sw' | 'se'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startPanX: number
  startPanY: number
  aspectRatio: number
  childStartPositions: Array<{ id: string; x: number; y: number }>
}

export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
} | null

export type TouchGestureState = {
  mode: 'pan' | 'pinch'
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
  startDistance: number
  startZoom: number
  worldCenterX: number
  worldCenterY: number
}

export type LayerTreeNode = TableLayer & {
  children: LayerTreeNode[]
}

export type LayerContextMenu = {
  layerId: string | null
  x: number
  y: number
} | null

export type LayerDropPlacement = 'before' | 'after' | 'inside'

export type LayerDropTarget = {
  layerId: string
  placement: LayerDropPlacement
} | null

export type RightRailTab = 'media' | 'rolls' | 'chat' | 'diary' | 'characters' | 'master'
export type MediaTab = 'music' | 'layers' | 'library'
export type LeftToolbarTab = 'scenes' | 'layers' | 'media' | 'music' | 'characters'

export type TableModule = Module<'table', 'vtm5'>
