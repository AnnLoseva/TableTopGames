'use client'

/**
 * Campaign table orchestrator: wires UI panels, hooks, and module APIs together.
 * Data access (Supabase) lives in @/games/vampires/modules/table/api/*; state in @/games/vampires/modules/table/hooks/*.
 */
import { ChangeEvent, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import dynamic from 'next/dynamic'
import { ATTRIBUTE_NAME_EN, findCrossLanguageName, getAttributeDots, resolveSkillValue, SKILL_NAME_EN } from '@/games/vampires/lib/i18n/ruleNames'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { loadVampireRulesDocument } from '@/games/vampires/lib/rules-catalog-client'
import MusicPlayer from '@/games/vampires/modules/music/components/MusicPlayer'
import MusicTopbarControl from '@/games/vampires/modules/music/components/MusicTopbarControl'
import { RoomMusicStateProvider } from '@/games/vampires/modules/music/hooks/useRoomMusicState'
import PlayerTopbarCharacter from '@/games/vampires/modules/table/components/topbar/PlayerTopbarCharacter'
import type { DiceOverlayRoll } from '@/games/vampires/modules/rolls/components/DiceRollOverlay'
import GameTableStyles from './components/GameTableStyles'
import LayerManager from './components/layers/LayerManager'
import TableCanvas from './components/canvas/TableCanvas'
import TokenLayer from './components/canvas/TokenLayer'
import TableLeftPanel from './components/panels/TableLeftPanel'
import TableRightPanel from './components/panels/TableRightPanel'
import CharactersPanel, { type CharacterListEntry } from './components/panels/CharactersPanel'
import SceneManager from './components/scenes/SceneManager'
import MediaLibrary from './components/media/MediaLibrary'
import { ChatPanel, useChat } from '@/games/vampires/modules/chat'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import JournalPanel from '@/games/vampires/modules/journal/components/JournalPanel'
import { VTM_THEME_CLASS } from '@/games/vampires/modules/ui/vtm-theme'
import MasterPanel from './components/master/MasterPanel'
import { tableDefaultDisciplineRules as defaultDisciplineRules } from './rules-subset'

import {
  ATTRIBUTE_GROUPS,
  DEFAULT_SCENE_HEIGHT,
  DEFAULT_SCENE_NAME,
  DEFAULT_SCENE_WIDTH,
  ROOT_LAYER_DROP_ID,
  SKILL_GROUPS,
  type InventoryCategory,
} from '@/games/vampires/modules/table/constants'
import {
  getCharacterType,
  getDefaultDamageProfile,
  normalizeWillpowerTracker,
} from '@/games/vampires/modules/table/mappers'
import {
  extractImageUrlsFromHtml,
  extractVideoUrlsFromHtml,
  getDroppedMediaUrls,
  getMediaSize,
  getMediaUrlsFromText,
} from '@/games/vampires/modules/table/utils/media-utils'
import {
  getCharacterBloodPotency,
  getCharacterDamageProfile,
  getCharacterHealth,
  getCharacterHealthStamina,
  getCharacterHunger,
  getCharacterWillpower,
  getWillpowerImpairmentPenalty,
  getWillpowerRecoveryPool,
} from '@/games/vampires/modules/table/utils/character-state'
import {
  getEditorImageStyle,
  buildLayerTree,
  getLayerMediaStyle,
  getSmartFloatingPosition,
  isLayerEffectivelyVisible,
  sortLayers,
} from '@/games/vampires/modules/table/utils/layer-utils'
import { sortSceneMusic } from '@/games/vampires/modules/table/utils/scene-utils'
import { intersectsScene, isObjectVisibleToPlayer } from '@/games/vampires/modules/table/utils/scene-geometry'
import { getCharacterSheetHref } from '@/games/vampires/modules/table/utils/table-urls'
import { getContestedOpponentOptions, getOpposedCharacterPool } from '@/games/vampires/modules/table/utils/contested-roll-helpers'
import { buildCharacterRollPool } from '@/games/vampires/modules/table/utils/roll-pool-builders'

import {
  CharacterPreviewModal,
  DisciplinePowerPanel,
  MasterPasswordGate,
  MasterRoleTopbar,
  OpposedRollModal,
  RollModifierControls,
  RollHistoryPanel,
  MediaPreviewModal,
  LayerContextMenuPanel,
} from '@/games/vampires/modules/table/components'
import {
  type DisciplinePowerEntry,
  type DisciplineRule,
  getActiveEffectDescription,
  getActiveEffectTitle,
  getCharacterPoolPartDots,
  getDisciplineCostLabel,
  getDisciplineManualPrompts,
  getDisciplinePowerDots,
  getDisciplinePowerEntries,
  getDisciplinePowerEntryKey,
  getDisciplinePowerInputFields,
  getPowerDifficultySummary,
  getPowerRollFormula,
  getPowerRollSummary,
  getSelectedDisciplinePowerLabels,
  getSelectedPathPowerNames,
  getSkillDotValue,
  getStandaloneSelectedPowerNames,
  hasSelectedPathPowers,
  isPowerEntrySelected,
  parsePowerPool,
  resolvePowerPool,
} from '@/games/vampires/modules/table/utils/discipline-ui'
import { formatRuleValue, formatTime, getDotDisplay } from '@/games/vampires/modules/table/utils/display'

import { getRollPenalties, getRollTraits } from '@/games/vampires/modules/table/utils/roll-pool-helpers'

import {
  useCharacterActions,
  useCharacterPreviewActions,
  useDiceOverlayActions,
  useDisciplineActions,
  useInventoryActions,
  useImageEditorActions,
  useJournalActions,
  useLayerActions,
  useLayerClipboardActions,
  useLayerManagerDragActions,
  useMediaUploadActions,
  useSceneActions,
  useSceneMusicActions,
  useTableSocialActions,
  usePoolRollActions,
  useQuickRollActions,
  useRollAttributeActions,
  useRollDamageActions,
  useRollPublishActions,
  useWillpowerRerollActions,
  useRoomSession,
  useTableCanvas,
  useTableVoice,
  useTableLayers,
  useTableRealtime,
  useTableRolls,
  useTableScenes,
  useTableTokens,
  useCharacterControllers,
  useTokenActions,
} from '@/games/vampires/modules/table/hooks'
import { DEFAULT_OPPOSED_RESPONSE } from '@/games/vampires/modules/rolls/constants'
import type {
  ContestedOpponentOption,
  DisciplineRollContext,
  QuickRollOptions,
} from '@/games/vampires/modules/rolls/types'
import { createQuickRollFactory } from '@/games/vampires/modules/rolls/hooks'
import {
  getActivePenaltyDelta,
  getBloodSurgeBonus,
  getRouseWarning,
} from '@/games/vampires/modules/rolls/utils'
import {
  tableApplyDisciplineEffectsToRoll,
  tableDisciplines,
  tableGetDerivedStats,
  tableHealth,
  tableHumanity,
} from '@/games/vampires/modules/table/system-runtime'
import type {
  DisciplineRollEffectResult,
  DisciplineRollPenalty,
} from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type {
  DisciplineCost,
  DisciplineCostPayment,
} from '@/games/vampires/core/vtm5/rules/disciplines/costs'
import type { ActiveEffect } from '@/games/vampires/core/vtm5/rules/disciplines/schema'
import type {
  ActiveParticipant,
  CharacterOption,
  CharacterRow,
  CharacterToken,
  ImageEditorDraft,
  ImageEditorState,
  InventoryItem,
  JournalEntry,
  LayerContextMenu,
  LayerDropTarget,
  LayerPatch,
  LayerTreeNode,
  LeftToolbarTab,
  MasterReveal,
  MasterWhisper,
  NormalizedHealth,
  MediaTab,
  OpposedRollProposal,
  RollMeta,
  RollPoolBuilder,
  RollMode,
  RightRailTab,
  RollMessage,
  SceneMusicTrack,
  SelectionRect,
  TableLayer,
  TableRole,
  TableScene,
  WillpowerRerollDraft,
} from '@/games/vampires/modules/table/types'

const DiceRollOverlay = dynamic(() => import('@/games/vampires/modules/rolls/components/DiceRollOverlay'), { ssr: false })

function isHydratedCharacter(character?: CharacterOption | null) {
  return Boolean(character && character.hydrated !== false)
}

export default function VampireTable() {
  const { t, tf, lang } = useLang()
  const d10 = (n: number) => lang === 'en' ? `${n}d10` : `${n}к10`
  const {
    room,
    roomRef,
    tableRole,
    isMaster,
    masterPasswordDraft,
    setMasterPasswordDraft,
    masterPasswordEdit,
    setMasterPasswordEdit,
    enterAsMaster,
    saveMasterPassword,
    resetTableRole,
    chooseTableRole,
  } = useRoomSession({ t })
  const { rolls, setRolls, rollsStatus } = useTableRolls(room)
  const {
    scenes,
    setScenes,
    activeSceneId,
    setActiveSceneId,
    selectedSceneId,
    setSelectedSceneId,
    sceneMusic,
    setSceneMusic,
    sceneMusicDraft,
    setSceneMusicDraft,
    sceneStatus,
    setSceneStatus,
    scenesRef,
    activeSceneIdRef,
    sceneMusicRef,
    loadSceneMusic,
    ensureDefaultScene,
  } = useTableScenes(room, t(DEFAULT_SCENE_NAME))
  const {
    layers,
    setLayers,
    layersRef,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayerIds,
    setSelectedLayerIds,
    loadLayersForScene: loadLayersForSceneCore,
  } = useTableLayers()
  const {
    tokens,
    setTokens,
    tokensRef,
    selectedTokenId,
    setSelectedTokenId,
    loadTokensForScene,
  } = useTableTokens()
  const [diceOverlayQueue, setDiceOverlayQueue] = useState<DiceOverlayRoll[]>([])
  const shownDiceOverlayIdsRef = useRef<Set<string>>(new Set())
  const [roomParticipants, setRoomParticipants] = useState<ActiveParticipant[]>([])
  const [previewCharacter, setPreviewCharacter] = useState<CharacterOption | null>(null)
  const [previewCharacterTab, setPreviewCharacterTab] = useState<'mechanics' | 'inventory'>('mechanics')
  const [previewRollAttribute, setPreviewRollAttribute] = useState('')
  const [previewRollAttributeTwo, setPreviewRollAttributeTwo] = useState('')
  const [previewRollSkill, setPreviewRollSkill] = useState('')
  const [previewRollDiscipline, setPreviewRollDiscipline] = useState('')
  const [previewRollModifier, setPreviewRollModifier] = useState(0)
  const [disabledPreviewRollModifierIds, setDisabledPreviewRollModifierIds] = useState<string[]>([])
  const [previewRollMode, setPreviewRollMode] = useState<RollMode>('normal')
  const [previewContestedOpponentId, setPreviewContestedOpponentId] = useState('')
  const [selectedMasterRollCharacterId, setSelectedMasterRollCharacterId] = useState('')
  const [masterRollVisibility, setMasterRollVisibility] = useState<'public' | 'hidden'>('hidden')
  const [masterRollAttribute, setMasterRollAttribute] = useState('')
  const [masterRollAttributeTwo, setMasterRollAttributeTwo] = useState('')
  const [masterRollSkill, setMasterRollSkill] = useState('')
  const [masterRollDiscipline, setMasterRollDiscipline] = useState('')
  const [masterRollModifier, setMasterRollModifier] = useState(0)
  const [disabledMasterRollModifierIds, setDisabledMasterRollModifierIds] = useState<string[]>([])
  const [masterRollMode, setMasterRollMode] = useState<RollMode>('normal')
  const [masterContestedOpponentId, setMasterContestedOpponentId] = useState('')
  const [incomingOpposedProposal, setIncomingOpposedProposal] = useState<OpposedRollProposal | null>(null)
  const [opposedResponseSide, setOpposedResponseSide] = useState<RollPoolBuilder>({ ...DEFAULT_OPPOSED_RESPONSE })
  const [previewDisciplineName, setPreviewDisciplineName] = useState('')
  const [disciplineRules, setDisciplineRules] = useState<Record<string, DisciplineRule> | null>(null)
  const [disciplineRulesStatus, setDisciplineRulesStatus] = useState('')
  const [previewPowerName, setPreviewPowerName] = useState('')
  const [previewPowerPoolSelections, setPreviewPowerPoolSelections] = useState<string[]>([])
  const [previewPowerModifier, setPreviewPowerModifier] = useState(0)
  const [disabledPreviewPowerModifierIds, setDisabledPreviewPowerModifierIds] = useState<string[]>([])
  const [previewPowerInputValues, setPreviewPowerInputValues] = useState<Record<string, string>>({})
  const [previewUseBloodSurge, setPreviewUseBloodSurge] = useState(false)
  const [masterUseBloodSurge, setMasterUseBloodSurge] = useState(false)
  const [willpowerRerollDraft, setWillpowerRerollDraft] = useState<WillpowerRerollDraft | null>(null)
  const [quickInventoryName, setQuickInventoryName] = useState('')
  const [quickInventoryCategory, setQuickInventoryCategory] = useState<InventoryCategory>('Другое')
  const [quickInventoryQuantity, setQuickInventoryQuantity] = useState(1)
  const [quickInventoryStatus, setQuickInventoryStatus] = useState('')
  const [isQuickInventoryBusy, setIsQuickInventoryBusy] = useState(false)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState('')
  const [journalSearch, setJournalSearch] = useState('')
  const [journalSaveStatus, setJournalSaveStatus] = useState('Сохранено')
  const [masterReveals, setMasterReveals] = useState<MasterReveal[]>([])
  const [masterWhispers, setMasterWhispers] = useState<MasterWhisper[]>([])
  const [masterChatDraft, setMasterChatDraft] = useState('')
  const [selectedMasterChatUserId, setSelectedMasterChatUserId] = useState('')

  const [previewLayerId, setPreviewLayerId] = useState<string | null>(null)
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [handNotice, setHandNotice] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [mediaUrlDraft, setMediaUrlDraft] = useState('')
  const [mediaSearchDraft, setMediaSearchDraft] = useState('')
  const [textMaterialDraft, setTextMaterialDraft] = useState('')
  const [textMaterialNameDraft, setTextMaterialNameDraft] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [layerContextMenu, setLayerContextMenu] = useState<LayerContextMenu>(null)
  const [imageEditor, setImageEditor] = useState<ImageEditorDraft | null>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [layerDropTarget, setLayerDropTarget] = useState<LayerDropTarget>(null)
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('rolls')
  const [mediaTab, setMediaTab] = useState<MediaTab>('layers')
  const [leftToolbarTab, setLeftToolbarTab] = useState<LeftToolbarTab>('scenes')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [musicPanelOpen, setMusicPanelOpen] = useState(true)
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const backgroundFileInputRef = useRef<HTMLInputElement>(null)
  const sceneMusicFileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const triggerDiceOverlayRef = useRef<((roll: RollMessage) => void) | null>(null)
  const broadcastRef = useRef<(event: string, payload: unknown) => void>(() => {})
  const setSceneBackgroundRef = useRef<(url: string, natural: { width: number; height: number }) => void | Promise<void>>(() => {})
  const imageEditorRef = useRef<ImageEditorDraft | null>(null)
  const panRef = useRef(pan)
  const chatUserRef = useRef<ChatUser | null>(null)
  const chatCharactersRef = useRef<CharacterOption[]>([])
  const playerLayoutInitRef = useRef(false)
  const publishRollRef = useRef<(roll: RollMessage) => Promise<void>>(async () => {})
  const createQuickRollRef = useRef<ReturnType<typeof createQuickRollFactory>>(async () => {
    throw new Error('createQuickRoll is not ready')
  })
  const rollQuickDiceRef = useRef<(
    diceCount?: number,
    poolName?: string,
    characterOverride?: CharacterOption,
    poolType?: string,
    options?: QuickRollOptions,
  ) => Promise<void>>(async () => {})
  const poolRollSnapshotRef = useRef({
    selectedMasterRollCharacter: null as CharacterOption | null,
    masterRollDiceCount: 0,
    masterRollMode: 'normal' as RollMode,
    selectedMasterContestedOpponent: null as ContestedOpponentOption | null,
    masterRollPoolBeforeLimit: 0,
    masterRollPoolName: '',
    masterRollHidden: false,
    masterUseBloodSurge: false,
    masterRollAttribute: '',
    masterRollAttributeTwo: '',
    masterRollSkill: '',
    masterRollDiscipline: '',
    masterWillpowerImpairmentPenalty: 0,
    masterHealthImpairmentPenalty: 0,
    disabledMasterRollModifierIds: [] as string[],
    previewCharacter: null as CharacterOption | null,
    canRollPreview: false,
    previewDiceCount: 0,
    previewRollMode: 'normal' as RollMode,
    selectedPreviewContestedOpponent: null as ContestedOpponentOption | null,
    previewPoolBeforeLimit: 0,
    previewBloodSurgeEnabled: false,
    previewRollAttribute: '',
    previewRollAttributeTwo: '',
    previewRollSkill: '',
    previewRollDiscipline: '',
    previewAttributeDots: 0,
    previewAttributeTwoDots: 0,
    previewSkillDots: 0,
    previewDisciplineDots: 0,
    previewRollModifier: 0,
    previewWillpowerImpairmentPenalty: 0,
    previewHealthImpairmentPenalty: 0,
    disabledPreviewRollModifierIds: [] as string[],
  })
  const layerContextRef = useRef({
    currentSceneId: null as string | null,
    currentOwnerId: null as string | null,
    selectedLayer: null as TableLayer | null,
    tableRole: null as TableRole | null,
  })
  const selectedChatCharacterIdRef = useRef('')
  const journalEntriesRef = useRef<JournalEntry[]>([])


  useEffect(() => {
    const folderInput = folderInputRef.current
    if (!folderInput) return
    folderInput.setAttribute('webkitdirectory', '')
    folderInput.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    setPreviewCharacterTab('mechanics')
    setPreviewRollAttribute('')
    setPreviewRollAttributeTwo('')
    setPreviewRollSkill('')
    setPreviewRollDiscipline('')
    setPreviewRollModifier(0)
    setDisabledPreviewRollModifierIds([])
    setPreviewRollMode('normal')
    setPreviewContestedOpponentId('')
    setPreviewDisciplineName('')
    setPreviewPowerName('')
    setDisabledPreviewPowerModifierIds([])
    setPreviewUseBloodSurge(false)
    setQuickInventoryName('')
    setQuickInventoryCategory('Другое')
    setQuickInventoryQuantity(1)
    setQuickInventoryStatus('')
  }, [previewCharacter?.id])

  useEffect(() => {
    const shouldLoadDisciplineRules = Boolean(
      previewDisciplineName
      || previewCharacter?.id
      || selectedMasterRollCharacterId,
    )
    if (!shouldLoadDisciplineRules || disciplineRules) return
    let active = true
    setDisciplineRulesStatus('Загружаю описание дисциплины...')
    Promise.all([
      loadVampireRulesDocument('ru') as Promise<{ disciplines?: Record<string, DisciplineRule> }>,
      loadVampireRulesDocument('en') as Promise<{ disciplines?: Record<string, DisciplineRule> }>,
    ])
      .then(([ruRules, enRules]) => {
        return {
          ...(ruRules.disciplines || {}),
          ...(enRules.disciplines || {}),
        }
      })
      .then(disciplines => {
        if (!active) return
        setDisciplineRules(disciplines)
        setDisciplineRulesStatus('')
      })
      .catch(error => {
        if (!active) return
        console.error('Не удалось загрузить правила дисциплин:', error)
        setDisciplineRulesStatus('Не удалось загрузить описание дисциплины.')
      })
    return () => {
      active = false
    }
  }, [previewDisciplineName, previewCharacter?.id, selectedMasterRollCharacterId, disciplineRules])

  const suppressNextContextMenuRef = useRef(false)
  const {
    chatMessages,
    chatUser,
    chatCharacters,
    setChatCharacters,
    selectedChatCharacterId,
    chooseActiveCharacter,
    chatPanelTab,
    setChatPanelTab,
    chatDraft,
    setChatDraft,
    sendChatMessage,
    hydrateChatCharacter,
  } = useChat({ chronicleId: room })
  const hydratedChatCharacters = useMemo(
    () => chatCharacters.filter(isHydratedCharacter),
    [chatCharacters],
  )
  const selectedActiveCharacter = hydratedChatCharacters.find(item => item.id === selectedChatCharacterId) || null

  const {
    controllers,
    controlledCharacterIds,
    loadControllers,
    assignCharacter,
    unassignController,
  } = useCharacterControllers({
    room,
    chatUser,
    chatCharacters: hydratedChatCharacters,
    broadcast: (event, payload) => broadcastRef.current(event, payload),
  })
  const controlledCharacterIdsRef = useRef<Set<string>>(new Set())
  controlledCharacterIdsRef.current = controlledCharacterIds

  useEffect(() => {
    imageEditorRef.current = imageEditor
  }, [imageEditor])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useEffect(() => {
    if (rollsStatus === 'error') setConnectionText('Нет общей истории')
    else if (rollsStatus === 'ok') setConnectionText('Онлайн')
  }, [rollsStatus])

  useEffect(() => {
    chatUserRef.current = chatUser
  }, [chatUser])

  useEffect(() => {
    chatCharactersRef.current = chatCharacters
  }, [chatCharacters])

  useEffect(() => {
    selectedChatCharacterIdRef.current = selectedChatCharacterId
  }, [selectedChatCharacterId])

  useEffect(() => {
    journalEntriesRef.current = journalEntries
  }, [journalEntries])

  const {
    voiceEnabled,
    voiceMuted,
    voiceStatus,
    voiceMasterVolume,
    voiceQuality,
    voiceNoiseSuppression,
    voiceInputDeviceId,
    voiceOutputDeviceId,
    voiceDevices,
    voiceParticipants,
    voiceAudioRefs,
    remoteStreamsRef,
    handleVoiceSignalRef,
    setVoiceMasterVolume,
    setVoiceQuality,
    setVoiceNoiseSuppression,
    selectVoiceInputDevice,
    selectVoiceOutputDevice,
    setVoiceStatus,
    setVoiceParticipantVolume,
    startVoice,
    stopVoice,
    toggleVoiceMuted,
  } = useTableVoice({
    roomRef,
    broadcast: (event, payload) => broadcastRef.current(event, payload),
    chatUserRef,
    chatCharactersRef,
    selectedChatCharacterIdRef,
    t,
  })

  useEffect(() => {
    if (!chatUser) {
      setSelectedMasterRollCharacterId('')
      return
    }
    if (!hydratedChatCharacters.length) {
      setSelectedMasterRollCharacterId('')
      return
    }

    const savedMasterRollId = window.localStorage.getItem(`vtm-master-roll-character:${chatUser.id}:${room}`)
      || window.localStorage.getItem(`vtm-master-roll-character:${chatUser.id}`)
    const savedIsValid = Boolean(savedMasterRollId && hydratedChatCharacters.some(character => character.id === savedMasterRollId))
    const fallbackId = selectedChatCharacterId && hydratedChatCharacters.some(character => character.id === selectedChatCharacterId)
      ? selectedChatCharacterId
      : hydratedChatCharacters[0]?.id || ''

    setSelectedMasterRollCharacterId(current => {
      const currentIsValid = Boolean(current && hydratedChatCharacters.some(character => character.id === current))
      const nextId = currentIsValid ? current : savedIsValid ? savedMasterRollId || '' : fallbackId
      if (nextId) {
        window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}:${room}`, nextId)
        window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}`, nextId)
      }
      return nextId
    })
  }, [hydratedChatCharacters, chatUser, room, selectedChatCharacterId])

  useEffect(() => {
    if (!layerContextMenu) return
    const closeMenu = () => setLayerContextMenu(null)
    const closeMenuOnClick = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.layer-context-menu')) return
      closeMenu()
    }
    window.addEventListener('click', closeMenuOnClick)
    window.addEventListener('keydown', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenuOnClick)
      window.removeEventListener('keydown', closeMenu)
    }
  }, [layerContextMenu])

  useEffect(() => {
    const handleHotkeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setRightRailTab('media')
        setMediaTab('library')
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-media-search]')?.focus(), 0)
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setRightRailTab('media')
        setMediaTab('layers')
        setRightPanelOpen(true)
      }
    }

    window.addEventListener('keydown', handleHotkeys)
    return () => window.removeEventListener('keydown', handleHotkeys)
  }, [])

  const getSelectedSceneId = () => selectedSceneId || activeSceneId || scenes[0]?.id || null

  const loadLayersForScene = async (targetRoom: string, sceneId: string) => {
    const result = await loadLayersForSceneCore(targetRoom, sceneId)
    setTableStatus(result.status)
  }

  const { channelRef, broadcast } = useTableRealtime({
    room,
    tf,
    chatUserRef,
    activeSceneIdRef,
    layersRef,
    setRolls,
    setLayers,
    setScenes,
    setSceneMusic,
    setActiveSceneId,
    setSelectedSceneId,
    setSelectedLayerId,
    setSelectedLayerIds,
    setConnectionText,
    setTableStatus,
    setHandNotice,
    setIncomingOpposedProposal,
    setRightRailTab,
    setRoomParticipants,
    setMasterReveals,
    setMasterWhispers,
    setZoom,
    setPan,
    setTokens,
    setSelectedTokenId,
    loadLayersForScene,
    loadSceneMusic,
    loadTokensForScene,
    loadControllers,
    ensureDefaultScene,
    onRollRef: triggerDiceOverlayRef,
    onVoiceSignalRef: handleVoiceSignalRef,
  })
  broadcastRef.current = broadcast

  const {
    canManageToken,
    canResizeToken,
    addCharacterToken,
    patchToken,
    broadcastTokenMove,
    bringTokenToFront,
    deleteToken,
  } = useTokenActions({
    room,
    t,
    tf,
    isMaster,
    chatUser,
    tokensRef,
    setTokens,
    setSelectedTokenId,
    setTableStatus,
    broadcast: (event, payload) => broadcastRef.current(event, payload),
    getActiveSceneId: () => activeSceneIdRef.current,
    getSceneBounds: () => {
      const scene = scenesRef.current.find(item => item.id === activeSceneIdRef.current)
      return {
        width: scene?.width || DEFAULT_SCENE_WIDTH,
        height: scene?.height || DEFAULT_SCENE_HEIGHT,
      }
    },
    canControlCharacterId: characterId => controlledCharacterIdsRef.current.has(characterId),
  })

  const {
    patchLayer,
    patchLayers,
    patchSelectedLayers,
    addMediaLayer,
    createFolder,
    deleteLayer,
    moveLayersToFolder,
    createFolderForSelection,
    placeLayerOnTable,
    reorderLayers,
    deleteSelectedLayers,
    duplicateLayer,
    renameLayer,
    resetLayerCrop,
    createNamedFolder,
    copyLayerToPersonalMedia,
    setLayerSelection,
    canEditLayer,
  } = useLayerActions({
    room,
    t,
    tf,
    isMaster,
    chatUser,
    layers,
    layersRef,
    setLayers,
    setSelectedLayerId,
    setSelectedLayerIds,
    setTableStatus,
    setRightRailTab,
    setExpandedFolders,
    setLayerContextMenu,
    setMediaTab,
    broadcast: (event, payload) => broadcastRef.current(event, payload),
    journalEntriesRef,
    getLayerContext: () => layerContextRef.current,
  })

  const {
    toggleFolder,
    revealLayerInTableManager,
    handleManagerDoubleClick,
    canMoveLayer,
    handleLayerDragStart,
    handleLayerDragOver,
    handleLayerDrop,
    handleLayerRootDragOver,
    handleLayerRootDrop,
    handleLayerDragEnd,
  } = useLayerManagerDragActions({
    isMaster,
    layersRef,
    draggingLayerId,
    layerDropTarget,
    setDraggingLayerId,
    setLayerDropTarget,
    setExpandedFolders,
    setRightRailTab,
    setMediaTab,
    setLayerContextMenu,
    setPreviewLayerId,
    canEditLayer,
    patchLayers,
    setLayerSelection,
    renameLayer,
  })

  const {
    uploadFiles,
    addRemoteMediaUrls,
    handleImageUpload,
    handleFolderUpload,
    handleBackgroundUpload,
    handleMediaUrlSubmit,
    createTextMaterial,
    handleSceneMediaDrop,
    handleTableLayerPanelDrop,
    pasteOnTable,
  } = useMediaUploadActions({
    room,
    t,
    isMaster,
    chatUser,
    mediaTab,
    mediaUrlDraft,
    textMaterialDraft,
    textMaterialNameDraft,
    layersRef,
    setIsUploading,
    setTableStatus,
    setRightRailTab,
    setMediaUrlDraft,
    setTextMaterialDraft,
    setTextMaterialNameDraft,
    addMediaLayer,
    createFolder,
    setSceneBackground: (url, natural) => setSceneBackgroundRef.current(url, natural),
  })

  const {
    openImageEditor,
    updateImageEditor,
    undoImageEditor,
    redoImageEditor,
    applyImageEditor,
    startEditorCropDrag,
    updateEditorCropDrag,
    finishEditorCropDrag,
  } = useImageEditorActions({
    setImageEditor,
    setLayerContextMenu,
    getImageEditor: () => imageEditorRef.current,
    getLayerById: id => layersRef.current.find(item => item.id === id),
    canEditLayer,
    patchLayer,
    addMediaLayer,
  })

  const {
    addSceneMusic,
    patchSceneMusic,
    renameSceneMusic,
    deleteSceneMusic,
    handleSceneMusicUpload,
    handleSceneMusicDrop,
    reorderSceneMusic,
  } = useSceneMusicActions({
    room,
    t,
    tf,
    isMaster,
    sceneMusicDraft,
    sceneMusicRef,
    setSceneMusic,
    setSceneMusicDraft,
    setIsUploading,
    getSelectedScene: () => {
      const id = selectedSceneId || activeSceneId || scenesRef.current[0]?.id || null
      const active = scenesRef.current.find(scene => scene.id === activeSceneId) || null
      return scenesRef.current.find(scene => scene.id === id) || active
    },
    getSelectedSceneMusic: () => {
      const id = selectedSceneId || activeSceneId || scenesRef.current[0]?.id || null
      const active = scenesRef.current.find(scene => scene.id === activeSceneId) || null
      const scene = scenesRef.current.find(item => item.id === id) || active
      return sortSceneMusic(sceneMusicRef.current.filter(track => track.sceneId === scene?.id))
    },
    broadcast,
  })

  const {
    updateCharacterHunger,
    updateCharacterHumanity,
    updateCharacterWillpower,
    updateCharacterHealth,
    syncHealthCharacter,
    applyCharacterHealthDamage,
    recoverCharacterHealth,
    addHumanityStains,
    performRemorseCheck,
    spendWillpower,
    recoverWillpower,
    adjustWillpowerStress,
    rollWillpowerCheck,
    performRouseCheck,
    rollRouseCheck,
    quenchHunger,
    setHungerLevel,
    cycleHealthCell,
    cycleWillpowerCell,
    removeHumanityStains,
    mendVampireSuperficial,
    mendVampireAggravated,
    recoverMortalHealth,
    treatMortalHealth,
    getRollCharacter,
  } = useCharacterActions({
    room,
    t,
    tf,
    disciplineRules,
    defaultDisciplineRules,
    chatUser,
    selectedActiveCharacterId: selectedChatCharacterId,
    setChatCharacters,
    setPreviewCharacter,
    setConnectionText,
    broadcast,
    getChatCharacters: () => hydratedChatCharacters,
    publishRollRef,
    rollQuickDiceRef,
  })

  const {
    deactivatePreviewDisciplinePower: runDeactivatePreviewDisciplinePower,
    rollPreviewPower: runRollPreviewPower,
    removePreviewActiveEffect: runRemovePreviewActiveEffect,
  } = useDisciplineActions({
    room,
    t,
    tf,
    previewDisciplineName,
    chatUser,
    selectedActiveCharacterId: selectedChatCharacterId,
    setChatCharacters,
    setPreviewCharacter,
    setConnectionText,
    broadcast,
    publishRollRef,
    rollQuickDiceRef,
    addHumanityStains,
  })

  const {
    addQuickInventoryItem,
    showInventoryItemToMaster,
  } = useInventoryActions({
    room,
    t,
    tf,
    chatUser,
    selectedActiveCharacterId: selectedChatCharacterId,
    quickInventoryName,
    quickInventoryCategory,
    quickInventoryQuantity,
    isQuickInventoryBusy,
    setQuickInventoryName,
    setQuickInventoryQuantity,
    setQuickInventoryStatus,
    setIsQuickInventoryBusy,
    setChatCharacters,
    setPreviewCharacter,
    broadcast,
    getPreviewCharacter: () => previewCharacter,
  })

  const {
    queueDiceOverlayRoll,
    triggerDiceOverlay,
  } = useDiceOverlayActions({
    t,
    tf,
    shownDiceOverlayIdsRef,
    setDiceOverlayQueue,
  })
  triggerDiceOverlayRef.current = triggerDiceOverlay

  const {
    publishRoll,
    publishOpposedRoll,
    publishRollReplacement,
    updateOpposedResponseSide,
    answerOpposedProposal,
    dismissOpposedProposal,
  } = useRollPublishActions({
    room,
    t,
    tf,
    d10,
    chatUser,
    disciplineRules,
    selectedActiveCharacter,
    opposedResponseSide,
    incomingOpposedProposal,
    setRolls,
    setConnectionText,
    setIncomingOpposedProposal,
    setOpposedResponseSide,
    broadcast,
    triggerDiceOverlay,
  })
  publishRollRef.current = publishRoll

  const { rollQuickDice } = useQuickRollActions({
    room,
    t,
    isMaster,
    disciplineRules,
    selectedActiveCharacter,
    createQuickRollRef,
    rollQuickDiceRef,
    performRouseCheck,
    publishRoll,
  })

  const {
    applyRollDamage,
    promptCharacterHealthDamage,
  } = useRollDamageActions({
    t,
    tf,
    chatCharacters: hydratedChatCharacters,
    getRollCharacter,
    applyCharacterHealthDamage,
  })

  const {
    canUseWillpowerReroll,
    toggleWillpowerRerollDie,
    confirmWillpowerReroll,
  } = useWillpowerRerollActions({
    t,
    tf,
    isMaster,
    willpowerRerollDraft,
    setWillpowerRerollDraft,
    getRollCharacter,
    spendWillpower,
    queueDiceOverlayRoll,
    publishRollReplacement,
  })

  const {
    toggleMasterRollAttribute,
    togglePreviewAttribute,
  } = useRollAttributeActions({
    masterRollAttribute,
    masterRollAttributeTwo,
    previewRollAttribute,
    previewRollAttributeTwo,
    setMasterRollAttribute,
    setMasterRollAttributeTwo,
    setPreviewRollAttribute,
    setPreviewRollAttributeTwo,
  })

  const {
    rollMasterPool,
    rollMasterQuick,
    rollPreviewPool,
  } = usePoolRollActions({
    room,
    t,
    tf,
    d10,
    chatUser,
    isMaster,
    setConnectionText,
    broadcast,
    publishRollRef,
    rollQuickDiceRef,
    createQuickRollRef,
    getPoolRollSnapshot: () => poolRollSnapshotRef.current,
  })

  const resolveSelectedScene = () => {
    const id = selectedSceneId || activeSceneId || scenesRef.current[0]?.id || null
    const active = scenesRef.current.find(scene => scene.id === activeSceneId) || null
    return scenesRef.current.find(scene => scene.id === id) || active
  }

  const {
    createScene,
    renameScene,
    activateScene,
    deleteScene,
    setSceneThumbnailFromSelection,
    saveSelectionAsGroup,
    publishSceneTrack,
    setSceneBackground,
    clearSceneBackground,
  } = useSceneActions({
    room,
    roomRef,
    t,
    tf,
    isMaster,
    selectedLayerIds,
    layers,
    layersRef,
    scenesRef,
    activeSceneIdRef,
    sceneMusicRef,
    channelRef,
    setScenes,
    setSelectedSceneId,
    setActiveSceneId,
    setSceneStatus,
    setExpandedFolders,
    getSelectedScene: resolveSelectedScene,
    getActiveScene: () => scenesRef.current.find(scene => scene.id === activeSceneId) || null,
    getCurrentOwnerId: () => (isMaster ? 'master' : chatUser?.id ?? null),
    loadLayersForScene,
    loadSceneMusic,
    broadcast,
    createFolder,
    addMediaLayer,
    patchLayer,
  })
  setSceneBackgroundRef.current = setSceneBackground

  const {
    sendMasterWhisper,
    raiseHand,
  } = useTableSocialActions({
    room,
    t,
    tf,
    isMaster,
    chatUser,
    chatCharacters,
    selectedChatCharacterId,
    masterChatDraft,
    selectedMasterChatUserId,
    setMasterChatDraft,
    setMasterWhispers,
    setHandNotice,
    broadcast,
  })

  const characterSheetHref = (characterId?: string | null) => getCharacterSheetHref(room, tableRole, characterId)

  const {
    chooseMasterRollCharacter,
    openCharacterPreview,
    openParticipantPreview,
    addExperienceToActiveCharacter,
  } = useCharacterPreviewActions({
    room,
    t,
    chatUser,
    chatCharacters,
    previewCharacter,
    selectedActiveCharacter,
    setPreviewCharacter,
    setSelectedMasterRollCharacterId,
    setChatCharacters,
    hydrateChatCharacter,
  })

  const contestedOpponentContext = {
    isMaster,
    chatUserId: chatUser?.id,
    roomParticipants,
    chatCharacters: hydratedChatCharacters,
    t,
    tf,
  }
  const opposedPoolContext = { t, d10, disciplineRules }

  const selectedMasterRollCharacter = hydratedChatCharacters.find(item => item.id === selectedMasterRollCharacterId) || selectedActiveCharacter
  const journalStorageKey = chatUser ? `vtm-journal:${chatUser.id}:${room}` : ''
  const selectedJournalEntry = journalEntries.find(entry => entry.id === selectedJournalEntryId) || journalEntries[0] || null

  const {
    saveJournalEntries,
    createJournalEntry,
    updateJournalEntry,
    persistCurrentJournal,
    deleteJournalEntry,
  } = useJournalActions({
    t,
    tf,
    journalStorageKey,
    journalEntries,
    selectedJournalEntry,
    setJournalEntries,
    setSelectedJournalEntryId,
    setJournalSaveStatus,
  })

  const {
    getContextLayerIds,
    copyLayerForDiary,
    addLayerToJournal,
    copyLayerUrl,
    focusLayersForEveryone,
  } = useLayerClipboardActions({
    room,
    t,
    chatUser,
    selectedLayerIds,
    journalEntries,
    selectedJournalEntry,
    layersRef,
    sceneRef,
    setTableStatus,
    setLayerContextMenu,
    setRightRailTab,
    setSelectedJournalEntryId,
    setZoom,
    setPan,
    saveJournalEntries,
    broadcast,
  })

  const filteredJournalEntries = journalEntries.filter(entry => {
    const query = journalSearch.trim().toLowerCase()
    if (!query) return true
    return `${entry.title} ${entry.text}`.toLowerCase().includes(query)
  })
  const masterChatPlayers = roomParticipants.filter(participant => participant.userId !== chatUser?.id)
  const visibleMasterWhispers = masterWhispers.filter(message => {
    if (!chatUser) return false
    if (isMaster) return !selectedMasterChatUserId
      ? true
      : message.fromUserId === selectedMasterChatUserId || message.toUserId === selectedMasterChatUserId
    return message.fromUserId === chatUser.id || message.toUserId === chatUser.id
  })
  const getSkillDots = (value: unknown) => getSkillDotValue(value)
  const getSkillSpecs = (value: unknown) => {
    if (!value || typeof value !== 'object') return []
    const specs = (value as { specs?: unknown }).specs
    return Array.isArray(specs) ? specs.filter((spec): spec is string => typeof spec === 'string') : []
  }
  const getDisciplineDots = (sources: Record<string, number>) => Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)

  const {
    attributeDots: masterRollAttributeDots,
    attributeTwoDots: masterRollAttributeTwoDots,
    skillDots: masterRollSkillDots,
    disciplineDots: masterRollDisciplineDots,
    poolBeforeLimit: masterRollPoolBeforeLimit,
    willpowerImpairmentPenalty: masterWillpowerImpairmentPenalty,
    healthImpairmentPenalty: masterHealthImpairmentPenalty,
    rollEffectResult: masterRollEffectResult,
    diceCount: masterRollDiceCount,
    poolName: masterRollPoolName,
    extraAttributes: masterRollExtraAttributes,
    extraSkills: masterRollExtraSkills,
    disciplineNames: masterRollDisciplineNames,
  } = buildCharacterRollPool({
    character: selectedMasterRollCharacter,
    attribute: masterRollAttribute,
    attributeTwo: masterRollAttributeTwo,
    skill: masterRollSkill,
    discipline: masterRollDiscipline,
    modifier: masterRollModifier,
    rollMode: masterRollMode,
    useBloodSurge: masterUseBloodSurge,
    poolType: 'master-character',
    disciplineRules,
    disabledModifierIds: disabledMasterRollModifierIds,
    t,
    d10,
  })
  const masterBloodPotency = getCharacterBloodPotency(selectedMasterRollCharacter)
  const masterBloodSurgeBonus = getBloodSurgeBonus(masterBloodPotency)
  const masterRollHidden = masterRollVisibility === 'hidden'
  const masterContestedOpponentOptions = getContestedOpponentOptions(contestedOpponentContext, selectedMasterRollCharacter)
  const selectedMasterContestedOpponent = masterContestedOpponentOptions.find(option => option.id === masterContestedOpponentId) || null

  useEffect(() => {
    if (!incomingOpposedProposal) return
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
  }, [incomingOpposedProposal?.id, selectedActiveCharacter?.id])

  const {
    attributeDots: previewAttributeDots,
    attributeTwoDots: previewAttributeTwoDots,
    skillDots: previewSkillDots,
    disciplineDots: previewDisciplineDots,
    poolBeforeLimit: previewPoolBeforeLimit,
    willpowerImpairmentPenalty: previewWillpowerImpairmentPenalty,
    healthImpairmentPenalty: previewHealthImpairmentPenalty,
    rollEffectResult: previewRollEffectResult,
    diceCount: previewDiceCount,
    extraAttributes: previewExtraAttributes,
    extraSkills: previewExtraSkills,
    disciplineNames: previewDisciplineNames,
  } = buildCharacterRollPool({
    character: previewCharacter,
    attribute: previewRollAttribute,
    attributeTwo: previewRollAttributeTwo,
    skill: previewRollSkill,
    discipline: previewRollDiscipline,
    modifier: previewRollModifier,
    rollMode: previewRollMode,
    useBloodSurge: previewUseBloodSurge,
    poolType: 'character-sheet',
    disciplineRules,
    disabledModifierIds: disabledPreviewRollModifierIds,
    t,
    d10,
  })
  const previewHealth = getCharacterHealth(previewCharacter)
  const previewSheetFixed = previewCharacter?.sheetFixed ?? true
  const previewBloodPotency = getCharacterBloodPotency(previewCharacter)
  const previewBloodSurgeBonus = getBloodSurgeBonus(previewBloodPotency)
  const previewHunger = getCharacterHunger(previewCharacter)
  const previewWillpower = getCharacterWillpower(previewCharacter)
  const previewHealthDerived = previewCharacter?.derivedStats.health
  const previewWillpowerDerived = previewCharacter?.derivedStats.willpower
  const previewDamageProfile = getCharacterDamageProfile(previewCharacter)
  const previewUsesVampireResources = Boolean(previewCharacter && ['vampire', 'thinblood'].includes(previewCharacter.characterType))
  const previewBloodSurgeEnabled = previewUsesVampireResources && previewUseBloodSurge
  const previewHumanity = previewCharacter?.humanity || {
    value: 7,
    stains: 0,
    stainEvents: [],
    lastRemorseCheckAt: null,
    lastHumanityLossAt: null,
    freeBoxes: 3,
    status: 'normal' as const,
  }
  const canRollPreview = Boolean(previewCharacter?.id && (
    isMaster
    || previewCharacter.id === selectedActiveCharacter?.id
    || controlledCharacterIds.has(previewCharacter.id)
  ))
  const previewContestedOpponentOptions = getContestedOpponentOptions(contestedOpponentContext, previewCharacter)
  const selectedPreviewContestedOpponent = previewContestedOpponentOptions.find(option => option.id === previewContestedOpponentId) || null
  const canEditPreviewInventory = Boolean(chatUser && previewCharacter?.id && previewCharacter.id === selectedActiveCharacter?.id)
  const canEditPreviewActiveEffects = canEditPreviewInventory
  const previewDisciplineRule = previewDisciplineName && disciplineRules ? disciplineRules[previewDisciplineName] : undefined
  const previewOpenedDisciplineDots = previewCharacter && previewDisciplineName
    ? getDisciplineDots(previewCharacter.disciplines[previewDisciplineName] || {})
    : 0
  const previewLearnedPathPowers = previewCharacter && previewDisciplineName
    ? getSelectedPathPowerNames(previewCharacter.selectedPathPowers[previewDisciplineName])
    : {}
  const previewLearnedPowers = previewCharacter && previewDisciplineName
    ? getStandaloneSelectedPowerNames(
        previewCharacter.selectedPowers[previewDisciplineName],
        previewCharacter.selectedPathPowers[previewDisciplineName],
      )
    : []
  const allPreviewDisciplinePowers = getDisciplinePowerEntries(previewDisciplineRule)
  const hasPreviewLearnedPathPowers = hasSelectedPathPowers(previewLearnedPathPowers)
  const previewDisciplinePowers = previewLearnedPowers.length || hasPreviewLearnedPathPowers
    ? allPreviewDisciplinePowers.filter(power => isPowerEntrySelected(
        power,
        previewLearnedPowers,
        previewLearnedPathPowers,
      ))
    : allPreviewDisciplinePowers.filter(power => power.level <= (
        previewCharacter && previewDisciplineName
          ? getDisciplinePowerDots(previewCharacter, previewDisciplineName, power.path)
          : previewOpenedDisciplineDots
      ))
  const selectedPreviewPower = previewDisciplinePowers.find(power => getDisciplinePowerEntryKey(power) === previewPowerName) || null
  const selectedPreviewPowerRollFormula = getPowerRollFormula(selectedPreviewPower?.rule)
  const selectedPreviewPowerRollSummary = getPowerRollSummary(selectedPreviewPower?.rule, tf)
  const selectedPreviewPowerDifficultySummary = getPowerDifficultySummary(selectedPreviewPower?.rule, tf)
  const resolvedPreviewPowerPool = selectedPreviewPowerRollFormula && disciplineRules
    ? resolvePowerPool(selectedPreviewPowerRollFormula, disciplineRules)
    : selectedPreviewPowerRollFormula
  const previewPowerPoolChoices = parsePowerPool(resolvedPreviewPowerPool, previewDisciplineNames)
  const previewPowerOpposition = resolvedPreviewPowerPool.split(/\s+(?:vs\.?|против)\s+/i)[1]?.trim() || ''
  const previewPowerPoolBeforeLimit = previewCharacter
    ? previewPowerPoolSelections.reduce((sum, name) => sum + getCharacterPoolPartDots(previewCharacter, name), 0) + previewPowerModifier
    : 0
  const previewPowerWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty(previewPowerPoolSelections, previewCharacter)
  const previewPowerHealthImpairmentPenalty = tableHealth().getHealthImpairmentPenalty(previewPowerPoolSelections, previewHealth)
  const previewPowerRollEffectResult = previewCharacter
    ? tableApplyDisciplineEffectsToRoll({
        characterData: previewCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: previewPowerPoolBeforeLimit,
        poolType: 'discipline-power',
        kind: 'roll',
        action: selectedPreviewPower?.name || 'discipline-power',
        source: 'discipline',
        traits: getRollTraits(...previewPowerPoolSelections, previewDisciplineName),
        penalties: getRollPenalties(t,previewPowerWillpowerImpairmentPenalty, previewPowerHealthImpairmentPenalty),
        disabledModifierIds: disabledPreviewPowerModifierIds,
      }, previewCharacter.derivedStats)
    : null
  const previewPowerDiceCount = previewPowerRollEffectResult?.finalDiceCount || 0
  const selectedPreviewPowerCost = tableDisciplines().resolveDisciplineCost({
    mechanics: selectedPreviewPower?.rule.mechanics,
    legacyCost: selectedPreviewPower?.rule.cost,
  })
  const selectedPreviewPowerCostLabel = getDisciplineCostLabel(
    selectedPreviewPowerCost,
    selectedPreviewPower?.rule.cost,
    t,
    tf,
  )
  const selectedPreviewPowerInputFields = getDisciplinePowerInputFields(
    selectedPreviewPower?.rule.mechanics,
  )
  const selectedPreviewPowerManualPrompts = getDisciplineManualPrompts(
    selectedPreviewPower?.rule.mechanics,
  )
  const hasMissingPreviewPowerInput = selectedPreviewPowerInputFields.some(
    field => field.required && !previewPowerInputValues[field.id]?.trim(),
  )
  const selectedPreviewPowerIsActiveKind = selectedPreviewPower?.rule.mechanics?.activation?.kind === 'active'
  const selectedPreviewPowerIsActive = Boolean(
    previewCharacter
    && selectedPreviewPower
    && selectedPreviewPowerIsActiveKind
    && tableDisciplines().isDisciplinePowerActive(
      previewCharacter,
      selectedPreviewPower.rule.mechanics || {},
      {
        discipline: previewDisciplineName,
        path: selectedPreviewPower.path,
        power: selectedPreviewPower.name,
        level: selectedPreviewPower.level,
      },
    ),
  )

  poolRollSnapshotRef.current = {
    selectedMasterRollCharacter,
    masterRollDiceCount,
    masterRollMode,
    selectedMasterContestedOpponent,
    masterRollPoolBeforeLimit,
    masterRollPoolName,
    masterRollHidden,
    masterUseBloodSurge,
    masterRollAttribute,
    masterRollAttributeTwo,
    masterRollSkill,
    masterRollDiscipline,
    masterWillpowerImpairmentPenalty,
    masterHealthImpairmentPenalty,
    disabledMasterRollModifierIds,
    previewCharacter,
    canRollPreview,
    previewDiceCount,
    previewRollMode,
    selectedPreviewContestedOpponent,
    previewPoolBeforeLimit,
    previewBloodSurgeEnabled,
    previewRollAttribute,
    previewRollAttributeTwo,
    previewRollSkill,
    previewRollDiscipline,
    previewAttributeDots,
    previewAttributeTwoDots,
    previewSkillDots,
    previewDisciplineDots,
    previewRollModifier,
    previewWillpowerImpairmentPenalty,
    previewHealthImpairmentPenalty,
    disabledPreviewRollModifierIds,
  }

  useEffect(() => {
    if (!previewDisciplineName || !disciplineRules) return
    const disciplineRule = disciplineRules[previewDisciplineName]
    const allPowers = getDisciplinePowerEntries(disciplineRule)
    const learnedPathPowers = previewCharacter ? getSelectedPathPowerNames(previewCharacter.selectedPathPowers[previewDisciplineName]) : {}
    const learnedPowers = previewCharacter
      ? getStandaloneSelectedPowerNames(
          previewCharacter.selectedPowers[previewDisciplineName],
          previewCharacter.selectedPathPowers[previewDisciplineName],
        )
      : []
    const hasLearnedPathPowers = hasSelectedPathPowers(learnedPathPowers)
    const visiblePowers = learnedPowers.length || hasLearnedPathPowers
      ? allPowers.filter(power => isPowerEntrySelected(
          power,
          learnedPowers,
          learnedPathPowers,
        ))
      : allPowers.filter(power => power.level <= (
          previewCharacter
            ? getDisciplinePowerDots(previewCharacter, previewDisciplineName, power.path)
            : previewOpenedDisciplineDots
        ))
    setPreviewPowerName(current => visiblePowers.some(power => getDisciplinePowerEntryKey(power) === current) ? current : visiblePowers[0] ? getDisciplinePowerEntryKey(visiblePowers[0]) : '')
  }, [previewDisciplineName, disciplineRules, previewCharacter, previewOpenedDisciplineDots])

  useEffect(() => {
    setPreviewPowerPoolSelections(previewPowerPoolChoices.map(choice => choice.options[0] || ''))
    setPreviewPowerModifier(0)
    setDisabledPreviewPowerModifierIds([])
    setPreviewPowerInputValues({})
  }, [previewPowerName, resolvedPreviewPowerPool])

  useEffect(() => {
    setMasterRollAttribute('')
    setMasterRollAttributeTwo('')
    setMasterRollSkill('')
    setMasterRollDiscipline('')
    setMasterRollModifier(0)
    setDisabledMasterRollModifierIds([])
    setMasterRollMode('normal')
    setMasterContestedOpponentId('')
  }, [selectedMasterRollCharacterId])

  const openPreviewDiscipline = (name: string) => {
    setPreviewDisciplineName(name)
    setPreviewPowerName('')
  }

  const clearPreviewHealth = () => {
    if (!previewCharacter) return
    if (window.confirm(t('Полностью очистить шкалу здоровья?'))) {
      void updateCharacterHealth(previewCharacter.id, tableHealth().normalizeHealthTracker({
        ...tableHealth().toHealthTracker(previewHealth),
        superficial: 0,
        aggravated: 0,
      }, getCharacterHealthStamina(previewCharacter), previewDamageProfile), 'Здоровье очищено')
    }
  }

  const markPreviewTorporOrComa = () => {
    if (!previewCharacter) return
    const stateName = previewDamageProfile === 'vampire' ? 'торпор' : 'кому/смерть'
    if (window.confirm(tf('Отметить {state} и заполнить шкалу тяжёлыми повреждениями?', { state: t(stateName) }))) {
      void updateCharacterHealth(previewCharacter.id, tableHealth().normalizeHealthTracker({
        ...tableHealth().toHealthTracker(previewHealth),
        superficial: 0,
        aggravated: previewHealth.max,
      }, getCharacterHealthStamina(previewCharacter), previewDamageProfile), stateName)
    }
  }

  const confirmRecoverPreviewAggravatedWillpower = () => {
    if (!previewCharacter) return
    if (window.confirm(t('Снять один тяжёлый стресс Воли?'))) {
      void recoverWillpower(previewCharacter, 1, 'aggravated', 'Воля: восстановление тяжёлого стресса')
    }
  }

  const deactivatePreviewDisciplinePower = async () => {
    if (!previewCharacter || !selectedPreviewPower) return
    await runDeactivatePreviewDisciplinePower({
      previewCharacter,
      selectedPreviewPower,
      canRollPreview,
      selectedPreviewPowerIsActive,
      previewDisciplineName,
    })
  }

  const rollPreviewPower = async () => {
    if (!previewCharacter || !selectedPreviewPower) return
    await runRollPreviewPower({
      previewCharacter,
      selectedPreviewPower,
      canRollPreview,
      hasMissingPreviewPowerInput,
      previewDisciplineName,
      selectedPreviewPowerCostLabel,
      selectedPreviewPowerCost,
      previewPowerInputValues,
      previewPowerDiceCount,
      previewPowerPoolChoices,
      previewPowerPoolBeforeLimit,
      previewPowerPoolSelections,
      previewPowerModifier,
      previewPowerWillpowerImpairmentPenalty,
      previewPowerHealthImpairmentPenalty,
      disabledPreviewPowerModifierIds,
    })
  }

  const removePreviewActiveEffect = async (effectId: string) => {
    if (!previewCharacter || !chatUser) return
    await runRemovePreviewActiveEffect({
      previewCharacter,
      chatUser,
      canEditPreviewActiveEffects,
      effectId,
    })
  }

  useEffect(() => {
    if (!chatUser || !journalStorageKey) {
      setJournalEntries([])
      setSelectedJournalEntryId('')
      return
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(journalStorageKey) || '[]') as JournalEntry[]
      const entries = Array.isArray(parsed) ? parsed : []
      setJournalEntries(entries)
      setSelectedJournalEntryId(entries[0]?.id || '')
      setJournalSaveStatus('Сохранено')
    } catch {
      setJournalEntries([])
      setSelectedJournalEntryId('')
    }
  }, [chatUser, journalStorageKey])

  useEffect(() => {
    if (!chatUser || journalSaveStatus !== 'Есть несохранённые изменения') return
    const timeout = window.setTimeout(() => persistCurrentJournal(), 800)
    return () => window.clearTimeout(timeout)
  }, [journalEntries, journalSaveStatus, chatUser])

  useEffect(() => {
    if (!chatUser || !journalStorageKey) return
    const interval = window.setInterval(() => {
      window.localStorage.setItem(journalStorageKey, JSON.stringify(journalEntriesRef.current))
      setJournalSaveStatus('Сохранено')
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [chatUser, journalStorageKey])

  useEffect(() => {
    if (!chatUser) return
    const character = selectedActiveCharacter
    const participant: ActiveParticipant = {
      userId: chatUser.id,
      username: chatUser.username,
      characterId: character?.id || null,
      characterName: character?.name || 'без персонажа',
      characterClan: character?.clan || null,
      characterImage: character?.image || '',
      updatedAt: new Date().toISOString(),
    }
    setRoomParticipants(prev => {
      const exists = prev.some(item => item.userId === participant.userId)
      return exists ? prev.map(item => item.userId === participant.userId ? participant : item) : [participant, ...prev]
    })
    broadcast('active-character', { room, participant })
  }, [chatUser, selectedChatCharacterId, chatCharacters, room])

  const activeScene = scenes.find(scene => scene.id === activeSceneId) || null
  const selectedScene = scenes.find(scene => scene.id === getSelectedSceneId()) || activeScene
  const activeSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === activeSceneId)), [sceneMusic, activeSceneId])
  const selectedSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === selectedScene?.id)), [sceneMusic, selectedScene?.id])
  const isMusicPanelVisible = isMaster && leftPanelOpen && leftToolbarTab === 'music'

  useEffect(() => {
    if (tableRole !== 'player' || playerLayoutInitRef.current) return
    playerLayoutInitRef.current = true
    setRightPanelOpen(false)
    setMediaTab('library')
  }, [tableRole])

  useEffect(() => {
    if (!isMaster && rightRailTab === 'media') setMediaTab('library')
  }, [isMaster, rightRailTab])

  const togglePlayerJournal = () => {
    if (rightRailTab === 'diary' && rightPanelOpen) {
      setRightPanelOpen(false)
      return
    }
    setRightRailTab('diary')
    setRightPanelOpen(true)
  }
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) || null
  const previewLayer = layers.find(layer => layer.id === previewLayerId) || null
  const currentOwnerId = isMaster ? 'master' : chatUser?.id ?? null
  const currentSceneId = activeSceneId || scenes[0]?.id || null

  layerContextRef.current = {
    currentSceneId,
    currentOwnerId,
    selectedLayer,
    tableRole,
  }

  const stageBounds = useMemo(() => ({
    width: activeScene?.width || DEFAULT_SCENE_WIDTH,
    height: activeScene?.height || DEFAULT_SCENE_HEIGHT,
  }), [activeScene?.width, activeScene?.height])

  const visibleLayers = useMemo(
    () => sortLayers(layers).filter(layer => {
      if (!isLayerEffectivelyVisible(layer, layers)) return false
      // Master sees the whole workspace; players only what intersects the stage
      // (everything beyond the stage rectangle is the master's prep area).
      if (isMaster) return true
      return intersectsScene(layer, stageBounds)
    }),
    [layers, isMaster, stageBounds],
  )

  const visibleTokens = useMemo(() => {
    if (isMaster) return tokens
    return tokens.filter(token => isObjectVisibleToPlayer({
      object: token,
      scene: stageBounds,
      isOwnToken: controlledCharacterIds.has(token.characterId),
    }))
  }, [tokens, isMaster, stageBounds, controlledCharacterIds])

  const isOwnToken = (token: CharacterToken) => controlledCharacterIds.has(token.characterId)

  const openCharacterCard = (character: { id: string; name: string; image: string }) => {
    if (!isMaster && !controlledCharacterIds.has(character.id)) {
      setHandNotice('У вас нет доступа к этому персонажу')
      window.setTimeout(() => setHandNotice(''), 3200)
      return
    }
    void openCharacterPreview({
      id: character.id,
      name: character.name,
      clan: null,
      image: character.image,
      hydrated: false,
      characterType: 'vampire',
      inventory: [],
      attributes: {},
      skills: {},
      disciplines: {},
      selectedPowers: {},
      selectedPathPowers: {},
      derivedStats: tableGetDerivedStats({}, {}),
      activeEffects: [],
    } as CharacterOption)
  }

  const openTokenCharacter = (token: CharacterToken) => {
    openCharacterCard({ id: token.characterId, name: token.characterName, image: token.imageUrl })
  }

  const focusCharacterToken = (characterId: string) => {
    const token = tokensRef.current.find(item => item.characterId === characterId)
    if (!token) return
    setSelectedTokenId(token.id)
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    setPan({
      x: Math.round(rect.width / 2 - (token.x + token.width / 2) * zoom),
      y: Math.round(rect.height / 2 - (token.y + token.height / 2) * zoom),
    })
  }

  const ownCharacterEntries = useMemo<CharacterListEntry[]>(() => hydratedChatCharacters.map(character => ({
    id: character.id,
    name: character.name,
    clan: character.clan,
    image: character.image,
    userId: character.userId,
    username: character.username,
  })), [hydratedChatCharacters])

  const masterCharacterEntries = useMemo<CharacterListEntry[]>(() => {
    const map = new Map<string, CharacterListEntry>()
    ownCharacterEntries.forEach(entry => map.set(entry.id, entry))
    roomParticipants.forEach(participant => {
      if (participant.characterId && !map.has(participant.characterId)) {
        map.set(participant.characterId, {
          id: participant.characterId,
          name: participant.characterName,
          clan: participant.characterClan,
          image: participant.characterImage,
          userId: participant.userId,
          username: participant.username,
        })
      }
    })
    return [...map.values()]
  }, [ownCharacterEntries, roomParticipants])

  const panelBaseEntries = isMaster ? masterCharacterEntries : ownCharacterEntries
  const panelExtraCharacterIds = useMemo(() => {
    const known = new Set(panelBaseEntries.map(entry => entry.id))
    const relevant = isMaster
      ? controllers
      : controllers.filter(controller => controller.userId === chatUser?.id)
    return [...new Set(relevant.map(controller => controller.characterId).filter(id => !known.has(id)))]
  }, [panelBaseEntries, controllers, isMaster, chatUser?.id])

  const charactersPanel = (
    <CharactersPanel
      isMaster={isMaster}
      chatUser={chatUser}
      baseEntries={panelBaseEntries}
      extraCharacterIds={panelExtraCharacterIds}
      controllers={controllers}
      roomParticipants={roomParticipants}
      tokens={tokens}
      onAddToken={entry => void addCharacterToken({ id: entry.id, name: entry.name, image: entry.image })}
      onFindToken={focusCharacterToken}
      onOpenCharacter={entry => openCharacterCard({ id: entry.id, name: entry.name, image: entry.image })}
      assignCharacter={isMaster ? assignCharacter : undefined}
      unassignController={isMaster ? unassignController : undefined}
    />
  )

  const setLayerAsBackground = async (layer: TableLayer) => {
    if (!isMaster || layer.layerType !== 'image' || !layer.imageData) return
    try {
      const natural = await getMediaSize(layer.imageData, 'image')
      await setSceneBackground(layer.imageData, natural)
    } catch (error) {
      console.error('Не удалось определить размер фонового изображения:', error)
    }
  }
  const checkLayerEffectivelyVisible = (layer: TableLayer) => isLayerEffectivelyVisible(layer, layers)
  const managerLayers = useMemo(
    () => (isMaster ? layers : layers.filter(layer => canEditLayer(layer))),
    [isMaster, layers, chatUser]
  )
  const tableManagerLayers = useMemo(() => managerLayers.filter(layer => layer.onTable), [managerLayers])
  const libraryLayers = useMemo(() => {
    const query = mediaSearchDraft.trim().toLowerCase()
    return managerLayers.filter(layer => !layer.onTable && (!query || layer.name.toLowerCase().includes(query) || layer.layerType.includes(query)))
  }, [managerLayers, mediaSearchDraft])
  const selectedManagerLayer = managerLayers.find(layer => layer.id === selectedLayerId) || null
  const layerTree = useMemo<LayerTreeNode[]>(() => {
    return buildLayerTree(tableManagerLayers)
  }, [tableManagerLayers])
  const libraryTree = useMemo<LayerTreeNode[]>(() => {
    return buildLayerTree(libraryLayers)
  }, [libraryLayers])

  const {
    previewLayerOpacity,
    commitLayerOpacity,
    getScenePointFromClient,
    startLayerDrag,
    startPan,
    updateLayerDrag,
    finishLayerDrag,
    handleWheel,
    startSceneTouch,
    updateSceneTouch,
    finishSceneTouch,
    handleDrop,
  } = useTableCanvas({
    room,
    zoom,
    pan,
    isMaster,
    selectedLayerIds,
    visibleLayers,
    sceneRef,
    panRef,
    layersRef,
    suppressNextContextMenuRef,
    setZoom,
    setPan,
    setLayers,
    setTableStatus,
    setSelectionRect,
    setSelectedLayerIds,
    setSelectedLayerId,
    setIsDraggingOver,
    broadcast,
    canEditLayer,
    patchLayer,
    setLayerSelection,
    placeLayerOnTable,
    uploadFiles,
    addRemoteMediaUrls,
    getDroppedMediaUrls,
    pasteOnTable,
  })

  const opposedResponsePool = getOpposedCharacterPool(opposedPoolContext, selectedActiveCharacter, opposedResponseSide)
  const canAnswerOpposedProposal = Boolean(incomingOpposedProposal && selectedActiveCharacter && opposedResponsePool.diceCount > 0)

  return (
    <RoomMusicStateProvider room={room}>
    <main className={`table-page-shell ${VTM_THEME_CLASS}`}>
      <section className="table-topbar">
        <div className="table-brand">
          <p className="table-kicker">{t('Игровой стол')} · V5 · {tf('комната {room}', { room })}</p>
          <h1>{activeScene?.name || room}</h1>
        </div>
        <div className="table-topbar-right">
          <MusicTopbarControl />
          {!isMaster ? (
            <button
              type="button"
              className={`table-journal-toggle ${rightRailTab === 'diary' && rightPanelOpen ? 'active' : ''}`}
              onClick={togglePlayerJournal}
              title={t('Дневник')}
            >
              {t('Дневник')}
            </button>
          ) : null}
          {!isMaster ? (
            <PlayerTopbarCharacter
              selectedActiveCharacter={selectedActiveCharacter}
              chatCharacters={chatCharacters}
              selectedChatCharacterId={selectedChatCharacterId}
              chatUser={chatUser}
              chooseActiveCharacter={chooseActiveCharacter}
              openCharacterPreview={openCharacterPreview}
              characterSheetHref={characterSheetHref}
              onNeedCharacter={() => {
                setRightRailTab('chat')
                setRightPanelOpen(true)
              }}
            />
          ) : null}
          <div className="table-actions">
          <a href="/vampires" title={t('Вернуться на главную страницу')}>{t('Главная')}</a>
          <MasterRoleTopbar
            tableRole={tableRole}
            isMaster={isMaster}
            masterPasswordEdit={masterPasswordEdit}
            onMasterPasswordEditChange={setMasterPasswordEdit}
            onResetTableRole={resetTableRole}
            onSaveMasterPassword={saveMasterPassword}
          />
          {isMaster ? (
            <a href={characterSheetHref(selectedActiveCharacter?.id)} title={t('Открыть лист персонажа')}>{t('Лист')}</a>
          ) : null}
          <input ref={fileInputRef} type="file" multiple onChange={handleImageUpload} />
          <input ref={folderInputRef} type="file" multiple onChange={handleFolderUpload} />
          <input ref={backgroundFileInputRef} type="file" accept="image/*" multiple onChange={handleBackgroundUpload} />
          <input ref={sceneMusicFileInputRef} type="file" accept="audio/*" multiple onChange={handleSceneMusicUpload} />
          </div>
        </div>
      </section>

      <MusicPlayer
        room={room}
        tableRole={tableRole}
        channelRef={channelRef}
        hidden
        playbackEnabled
      />

      <section className={`table-layout ${isMaster && leftPanelOpen ? 'with-left-toolbar' : ''} ${isMaster && !leftPanelOpen ? 'left-collapsed' : ''} ${!rightPanelOpen ? 'right-collapsed' : ''}`}>
        <TableLeftPanel
          isMaster={isMaster}
          leftPanelOpen={leftPanelOpen}
          setLeftPanelOpen={setLeftPanelOpen}
        >
        {isMaster && leftPanelOpen ? (
          <aside className="left-toolbar" aria-label={t('Мастерская панель сцен')}>
            <nav className="left-tabs" aria-label={t('Разделы сцен')}>
              <button type="button" className={leftToolbarTab === 'scenes' ? 'active' : ''} onClick={() => setLeftToolbarTab('scenes')}>{t('Сцены')}</button>
              <button type="button" className={leftToolbarTab === 'layers' ? 'active' : ''} onClick={() => setLeftToolbarTab('layers')}>{t('Слои')}</button>
              <button type="button" className={leftToolbarTab === 'media' ? 'active' : ''} onClick={() => setLeftToolbarTab('media')}>{t('Медиа')}</button>
              <button type="button" className={leftToolbarTab === 'music' ? 'active' : ''} onClick={() => setLeftToolbarTab('music')}>{t('Музыка')}</button>
              <button type="button" className={leftToolbarTab === 'characters' ? 'active' : ''} onClick={() => setLeftToolbarTab('characters')}>{t('Персонажи')}</button>
            </nav>

            <SceneManager
              leftToolbarTab={leftToolbarTab}
              activeScene={activeScene}
              selectedScene={selectedScene}
              sceneStatus={sceneStatus}
              scenes={scenes}
              selectedSceneMusic={selectedSceneMusic}
              room={room}
              sceneMusicDraft={sceneMusicDraft}
              isUploading={isUploading}
              sceneMusicFileInputRef={sceneMusicFileInputRef}
              createScene={createScene}
              renameScene={renameScene}
              deleteScene={deleteScene}
              activateScene={activateScene}
              loadSceneMusic={loadSceneMusic}
              setSelectedSceneId={setSelectedSceneId}
              handleSceneMusicDrop={handleSceneMusicDrop}
              addSceneMusic={addSceneMusic}
              setSceneMusicDraft={setSceneMusicDraft}
              reorderSceneMusic={reorderSceneMusic}
              publishSceneTrack={publishSceneTrack}
              patchSceneMusic={patchSceneMusic}
              renameSceneMusic={renameSceneMusic}
              deleteSceneMusic={deleteSceneMusic}
              clearSceneBackground={clearSceneBackground}
            />

            <section className={`scene-layer-panel ${leftToolbarTab === 'layers' ? '' : 'table-right-panel-hidden'}`}>
              <header>
                <strong>{t('Слои сцены')}</strong>
                <span>{activeScene?.name || t('активная сцена')}</span>
              </header>
              <div className="scene-layer-groups">
                {/* 'фон'/'токен' below match layer.name, a Storyteller-assigned scene-layer
                    label (data, not UI copy) — not part of the RU/EN site translation. */}
                {[
                  ['Фон', tableManagerLayers.filter(layer => layer.onTable && (layer.zIndex < 0 || layer.name.toLowerCase().includes('фон')))],
                  ['Картинки / декорации', tableManagerLayers.filter(layer => layer.onTable && ['image', 'video'].includes(layer.layerType) && layer.zIndex >= 0 && !layer.name.toLowerCase().includes('фон'))],
                  ['Токены', tableManagerLayers.filter(layer => layer.onTable && layer.name.toLowerCase().includes('токен'))],
                  ['Группы / папки', tableManagerLayers.filter(layer => layer.onTable && layer.layerType === 'folder')],
                  ['Текст / документы', tableManagerLayers.filter(layer => layer.onTable && ['text', 'file'].includes(layer.layerType))],
                ].map(([title, items]) => (
                  <details open key={title as string}>
                    <summary>{t(title as string)}<span>{(items as TableLayer[]).length}</span></summary>
                    <div
                      className={`layer-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                      onDragOver={handleLayerRootDragOver}
                      onDrop={handleLayerRootDrop}
                    >
                      {(items as TableLayer[]).length === 0 ? <p className="panel-empty">{t('Пусто')}</p> : <LayerManager layers={buildLayerTree(items as TableLayer[])}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section
              className={`scene-media-panel ${leftToolbarTab === 'media' ? '' : 'table-right-panel-hidden'}`}
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleSceneMediaDrop}
            >
              <header>
                <strong>{t('Медиа сцены')}</strong>
                <span>{selectedScene?.name || activeScene?.name || t('сцена')}</span>
              </header>
              <div className="media-manager-toolbar">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? t('Загрузка...') : t('Загрузить')}
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
                  {t('Папка файлов')}
                </button>
                <button type="button" onClick={() => backgroundFileInputRef.current?.click()} disabled={isUploading}>
                  {t('Фон')}
                </button>
                <button type="button" onClick={() => createNamedFolder(null, false)}>{t('Папка')}</button>
                <button type="button" onClick={saveSelectionAsGroup} disabled={selectedLayerIds.size === 0}>{t('Группа')}</button>
                <button type="button" onClick={setSceneThumbnailFromSelection} disabled={selectedLayerIds.size === 0}>Preview</button>
              </div>
              <form className="media-url-form" onSubmit={event => {
                event.preventDefault()
                const items = getMediaUrlsFromText(mediaUrlDraft)
                void addRemoteMediaUrls(items, undefined, false).then(added => {
                  if (added) setMediaUrlDraft('')
                })
              }}>
                <input
                  value={mediaUrlDraft}
                  onChange={event => setMediaUrlDraft(event.target.value)}
                  placeholder={t('Ссылка на картинку, видео или YouTube')}
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>{t('В папку')}</button>
              </form>
              <input
                className="media-search-input"
                data-media-search
                value={mediaSearchDraft}
                onChange={event => setMediaSearchDraft(event.target.value)}
                placeholder={t('Поиск медиа')}
              />
              <div
                className="layer-list library-list scene-media-drop-zone"
                onDragOver={event => {
                  event.preventDefault()
                  if (!event.dataTransfer.types.includes('Files')) handleLayerRootDragOver(event as React.DragEvent<HTMLDivElement>)
                }}
                onDrop={async event => {
                  if (event.dataTransfer.files.length > 0 || getDroppedMediaUrls(event.dataTransfer).length > 0) {
                    await handleSceneMediaDrop(event)
                    return
                  }
                  await handleLayerRootDrop(event as React.DragEvent<HTMLDivElement>)
                }}
              >
                {libraryTree.length === 0 ? <p className="panel-empty">{t('Подготовленные медиа этой сцены появятся здесь.')}</p> : <LayerManager layers={libraryTree}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />}
              </div>
            </section>

            {leftToolbarTab === 'music' ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <MusicPlayer room={room} tableRole={tableRole} channelRef={channelRef} playbackEnabled={false} />
              </div>
            ) : null}

            {leftToolbarTab === 'characters' ? (
              <section className="scene-characters-panel">
                {charactersPanel}
              </section>
            ) : null}
          </aside>
        ) : null}
        </TableLeftPanel>

        <TableCanvas
          layersLength={layers.length}
          zoom={zoom}
          pan={pan}
          handNotice={handNotice}
          isDraggingOver={isDraggingOver}
          stage={{
            width: stageBounds.width,
            height: stageBounds.height,
            backgroundUrl: activeScene?.backgroundUrl || '',
          }}
          clipMediaToStage={!isMaster}
          tokenLayer={(
            <TokenLayer
              tokens={visibleTokens}
              sceneBounds={stageBounds}
              zoom={zoom}
              isMaster={isMaster}
              clipForeign={!isMaster}
              selectedTokenId={selectedTokenId}
              setSelectedTokenId={setSelectedTokenId}
              isOwnToken={isOwnToken}
              canManageToken={canManageToken}
              canResizeToken={canResizeToken}
              broadcastTokenMove={broadcastTokenMove}
              patchToken={patchToken}
              bringTokenToFront={bringTokenToFront}
              deleteToken={deleteToken}
              onOpenCharacter={openTokenCharacter}
            />
          )}
          visibleLayers={visibleLayers}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          imageEditor={imageEditor}
          selectionRect={selectionRect}
          sceneRef={sceneRef}
          suppressNextContextMenuRef={suppressNextContextMenuRef}
          canEditLayer={canEditLayer}
          raiseHand={raiseHand}
          setZoom={setZoom}
          setIsDraggingOver={setIsDraggingOver}
          setLayerContextMenu={setLayerContextMenu}
          setLayerSelection={setLayerSelection}
          setSelectedLayerId={setSelectedLayerId}
          setImageEditor={setImageEditor}
          startPan={startPan}
          updateLayerDrag={updateLayerDrag}
          finishLayerDrag={finishLayerDrag}
          startSceneTouch={startSceneTouch}
          updateSceneTouch={updateSceneTouch}
          finishSceneTouch={finishSceneTouch}
          handleWheel={handleWheel}
          handleDrop={handleDrop}
          startLayerDrag={startLayerDrag}
          openImageEditor={openImageEditor}
          revealLayerInTableManager={revealLayerInTableManager}
          updateEditorCropDrag={updateEditorCropDrag}
          finishEditorCropDrag={finishEditorCropDrag}
          startEditorCropDrag={startEditorCropDrag}
          applyImageEditor={applyImageEditor}
          updateImageEditor={updateImageEditor}
          undoImageEditor={undoImageEditor}
          redoImageEditor={redoImageEditor}
          previewLayerOpacity={previewLayerOpacity}
          commitLayerOpacity={commitLayerOpacity}
        />

        <TableRightPanel
          isMaster={isMaster}
          rightPanelOpen={rightPanelOpen}
          rightRailTab={rightRailTab}
          setRightPanelOpen={setRightPanelOpen}
          setRightRailTab={setRightRailTab}
        >
          {!isMaster ? (
          <section className={`media-sidebar table-right-panel ${rightRailTab === 'media' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Мои медиа')}>
            <MediaLibrary
              mediaTab="library"
              isMaster={isMaster}
              isUploading={isUploading}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              mediaSearchDraft={mediaSearchDraft}
              textMaterialNameDraft={textMaterialNameDraft}
              textMaterialDraft={textMaterialDraft}
              libraryTree={libraryTree}
              layerDropTarget={layerDropTarget}
              expandedFolders={expandedFolders}
              selectedLayerIds={selectedLayerIds}
              draggingLayerId={draggingLayerId}
              createNamedFolder={createNamedFolder}
              setMediaSearchDraft={setMediaSearchDraft}
              setTextMaterialNameDraft={setTextMaterialNameDraft}
              setTextMaterialDraft={setTextMaterialDraft}
              createTextMaterial={createTextMaterial}
              handleLayerRootDragOver={handleLayerRootDragOver}
              handleLayerRootDrop={handleLayerRootDrop}
              uploadFiles={uploadFiles}
              setLayerDropTarget={setLayerDropTarget}
              canMoveLayer={canMoveLayer}
              isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
              handleLayerDragStart={handleLayerDragStart}
              handleLayerDragOver={handleLayerDragOver}
              handleLayerDrop={handleLayerDrop}
              handleLayerDragEnd={handleLayerDragEnd}
              handleManagerDoubleClick={handleManagerDoubleClick}
              patchLayer={patchLayer}
              placeLayerOnTable={placeLayerOnTable}
              deleteLayer={deleteLayer}
              setLayerSelection={setLayerSelection}
              setLayerContextMenu={setLayerContextMenu}
              toggleFolder={toggleFolder}
            />
          </section>
          ) : null}

          {!isMaster ? (
            <section className={`characters-sidebar table-right-panel ${rightRailTab === 'characters' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Мои персонажи')}>
              {charactersPanel}
            </section>
          ) : null}

          <section className={`roll-sidebar table-right-panel ${rightRailTab === 'rolls' ? '' : 'table-right-panel-hidden'}`} aria-label={t('История бросков')}>
            <RollHistoryPanel
              rolls={rolls}
              willpowerRerollDraft={willpowerRerollDraft}
              chatCharacters={chatCharacters}
              canUseWillpowerReroll={canUseWillpowerReroll}
              onToggleWillpowerRerollDie={toggleWillpowerRerollDie}
              onSetWillpowerRerollDraft={setWillpowerRerollDraft}
              onConfirmWillpowerReroll={confirmWillpowerReroll}
              onApplyRollDamage={applyRollDamage}
            />
          </section>

          <ChatPanel
            rightRailTab={rightRailTab}
            chatMessages={chatMessages}
            chatUser={chatUser}
            chatCharacters={chatCharacters}
            selectedChatCharacterId={selectedChatCharacterId}
            chatPanelTab={chatPanelTab}
            voiceStatus={voiceStatus}
            voiceEnabled={voiceEnabled}
            voiceMuted={voiceMuted}
            voiceMasterVolume={voiceMasterVolume}
            voiceQuality={voiceQuality}
            voiceNoiseSuppression={voiceNoiseSuppression}
            voiceInputDeviceId={voiceInputDeviceId}
            voiceOutputDeviceId={voiceOutputDeviceId}
            voiceDevices={voiceDevices}
            voiceParticipants={voiceParticipants}
            chatDraft={chatDraft}
            voiceAudioRefs={voiceAudioRefs}
            remoteStreamsRef={remoteStreamsRef}
            formatTime={formatTime}
            setChatPanelTab={setChatPanelTab}
            startVoice={startVoice}
            stopVoice={stopVoice}
            toggleVoiceMuted={toggleVoiceMuted}
            setVoiceMasterVolume={setVoiceMasterVolume}
            setVoiceQuality={setVoiceQuality}
            setVoiceNoiseSuppression={setVoiceNoiseSuppression}
            selectVoiceInputDevice={selectVoiceInputDevice}
            selectVoiceOutputDevice={selectVoiceOutputDevice}
            setVoiceStatus={setVoiceStatus}
            setVoiceParticipantVolume={setVoiceParticipantVolume}
            sendChatMessage={sendChatMessage}
            setChatDraft={setChatDraft}
          />

          {isMaster ? (
            <section className={`master-roll-sidebar table-right-panel ${rightRailTab === 'diary' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Персонажи мастера')}>
              <header>
                <div>
                  <span>{t('Персонажи')}</span>
                  <strong>{chatCharacters.length}</strong>
                </div>
                <div>
                  <span>{t('Бросок')}</span>
                  <strong>{masterRollHidden ? t('скрытый') : t('открытый')}</strong>
                </div>
              </header>

              {!chatUser ? (
                <div className="master-roll-empty">
                  <p>{t('Войди на главной, чтобы увидеть своих персонажей.')}</p>
                  <a href="/vampires">{t('На главную')}</a>
                </div>
              ) : chatCharacters.length === 0 ? (
                <div className="master-roll-empty">
                  <p>{t('Сохранённых персонажей пока нет.')}</p>
                  <a href={characterSheetHref()}>{t('Создать лист')}</a>
                </div>
              ) : (
                <div className="master-roll-layout">
                  <aside className="master-roll-character-list" aria-label={t('Персонажи для бросков')}>
                    {chatCharacters.map(character => (
                      <button
                        type="button"
                        key={character.id}
                        className={character.id === selectedMasterRollCharacter?.id ? 'active' : ''}
                        onClick={() => chooseMasterRollCharacter(character.id)}
                      >
                        <span className="chat-avatar" aria-hidden="true">
                          {character.image ? <img src={character.image} alt="" /> : <i>{(character.name || '?').slice(0, 1).toUpperCase()}</i>}
                        </span>
                        <span>
                          <strong>{character.name || t('Безымянный')}</strong>
                          <small>{character.clan || t('без клана')}</small>
                        </span>
                      </button>
                    ))}
                  </aside>

                  <section className="master-roll-builder" aria-label={t('Бросок персонажа мастера')}>
                    {selectedMasterRollCharacter ? (
                      <>
                        <div className="master-roll-current">
                          <div className="chat-avatar large" aria-hidden="true">
                            {selectedMasterRollCharacter.image ? (
                              <img src={selectedMasterRollCharacter.image} alt="" />
                            ) : (
                              <span>{(selectedMasterRollCharacter.name || '?').slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <span>{t('Выбран')}</span>
                            <strong>{selectedMasterRollCharacter.name}</strong>
                            <small>{tf('{clan} · Голод {hunger}/5 · Воля {willpowerCurrent}/{willpowerMax} · Сила Крови {bloodPotency}', {
                              clan: selectedMasterRollCharacter.clan || t('без клана'),
                              hunger: getCharacterHunger(selectedMasterRollCharacter),
                              willpowerCurrent: getCharacterWillpower(selectedMasterRollCharacter).current,
                              willpowerMax: getCharacterWillpower(selectedMasterRollCharacter).max,
                              bloodPotency: masterBloodPotency
                            })}</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void openCharacterPreview(selectedMasterRollCharacter)
                              setPreviewCharacterTab('mechanics')
                            }}
                          >
                            {t('Просмотр')}
                          </button>
                          <a href={characterSheetHref(selectedMasterRollCharacter.id)}>{t('Лист')}</a>
                        </div>

                        <div className="master-roll-mode" aria-label={t('Видимость броска')}>
                          <button
                            type="button"
                            className={masterRollVisibility === 'public' ? 'active' : ''}
                            onClick={() => setMasterRollVisibility('public')}
                          >
                            {t('Открытый')}
                          </button>
                          <button
                            type="button"
                            className={masterRollVisibility === 'hidden' ? 'active' : ''}
                            onClick={() => setMasterRollVisibility('hidden')}
                          >
                            {t('Скрытый')}
                          </button>
                        </div>

                        <div className="preview-roll-controls master-roll-controls">
                          <label>
                            <span>{t('Характеристика 1')}</span>
                            <select value={masterRollAttribute} onChange={event => setMasterRollAttribute(event.target.value)}>
                              <option value="">{t('Без характеристики')}</option>
                              {ATTRIBUTE_GROUPS.map(group => (
                                <optgroup key={group.name} label={group.name}>
                                  {group.traits.map(name => <option key={name} value={name} disabled={masterRollAttributeTwo === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraAttributes.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraAttributes.map(name => <option key={name} value={name} disabled={masterRollAttributeTwo === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Характеристика 2')}</span>
                            <select value={masterRollAttributeTwo} onChange={event => setMasterRollAttributeTwo(event.target.value)}>
                              <option value="">{t('Без второй характеристики')}</option>
                              {ATTRIBUTE_GROUPS.map(group => (
                                <optgroup key={group.name} label={t(group.name)}>
                                  {group.traits.map(name => <option key={name} value={name} disabled={masterRollAttribute === name}>{t(name)} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraAttributes.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraAttributes.map(name => <option key={name} value={name} disabled={masterRollAttribute === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Навык')}</span>
                            <select value={masterRollSkill} onChange={event => setMasterRollSkill(event.target.value)}>
                              <option value="">{t('Без навыка')}</option>
                              {SKILL_GROUPS.map(group => (
                                <optgroup key={group.name} label={t(group.name)}>
                                  {group.traits.map(name => <option key={name} value={name}>{t(name)} · {getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, name))}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraSkills.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraSkills.map(name => <option key={name} value={name}>{name} · {getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, name))}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Дисциплина')}</span>
                            <select value={masterRollDiscipline} onChange={event => setMasterRollDiscipline(event.target.value)}>
                              <option value="">{t('Без дисциплины')}</option>
                              {masterRollDisciplineNames.map(name => (
                                <option key={name} value={name}>{name} · {getDisciplineDots(selectedMasterRollCharacter.disciplines[name] || {})}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{t('Модификатор')}</span>
                            <input
                              type="number"
                              min="-20"
                              max="20"
                              value={masterRollModifier}
                              onChange={event => setMasterRollModifier(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                            />
                          </label>
                          <label className="preview-blood-surge-toggle">
                            <span>{tf('Прилив Крови +{bonus}к10', { bonus: masterBloodSurgeBonus })}</span>
                            <input
                              type="checkbox"
                              checked={masterUseBloodSurge}
                              onChange={event => setMasterUseBloodSurge(event.target.checked)}
                            />
                          </label>
                          <label className="roll-mode-field">
                            <span>{t('Тип броска')}</span>
                            <select
                              value={masterRollMode}
                              onChange={event => {
                                const nextMode = event.target.value as RollMode
                                setMasterRollMode(nextMode)
                                if (nextMode === 'normal') setMasterContestedOpponentId('')
                              }}
                            >
                              <option value="normal">{t('Обычный бросок')}</option>
                              <option value="contested">{t('Встречный бросок')}</option>
                            </select>
                          </label>
                          {masterRollMode === 'contested' ? (
                            <label className="contested-opponent-field">
                              <span>{t('Оппонент')}</span>
                              <select
                                value={masterContestedOpponentId}
                                onChange={event => setMasterContestedOpponentId(event.target.value)}
                                disabled={masterContestedOpponentOptions.length === 0}
                              >
                                <option value="">{masterContestedOpponentOptions.length ? t('Выбрать оппонента') : t('Нет доступных оппонентов')}</option>
                                {masterContestedOpponentOptions.map(option => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          <button
                            type="button"
                            className="preview-roll-submit"
                            onClick={rollMasterPool}
                            disabled={masterRollDiceCount < 1 || (masterRollMode === 'contested' && !selectedMasterContestedOpponent)}
                          >
                            {masterRollMode === 'contested' ? t('Запросить встречный') : t('Бросить')} {d10(Math.min(20, masterRollDiceCount + (masterUseBloodSurge ? masterBloodSurgeBonus : 0)) || 0)}
                          </button>
                        </div>

                        <RollModifierControls result={masterRollEffectResult} isMaster={isMaster} setDisabledIds={setDisabledMasterRollModifierIds} />

                        <div className="quick-roll-grid master-quick-rolls" aria-label={t('Быстрые броски мастера')}>
                          {[1, 3, 5, 7, 10].map(count => (
                            <button type="button" key={count} onClick={() => rollMasterQuick(count)}>
                              {d10(count)}
                            </button>
                          ))}
                        </div>

                        <div className="master-roll-traits">
                          {ATTRIBUTE_GROUPS.map(group => (
                            <section key={group.name}>
                              <strong>{t(group.name)}</strong>
                              {group.traits.map(name => {
                                const dots = getAttributeDots(selectedMasterRollCharacter.attributes, name)
                                return (
                                  <button
                                    type="button"
                                    key={name}
                                    className={masterRollAttribute === name || masterRollAttributeTwo === name ? 'active' : ''}
                                    onClick={() => toggleMasterRollAttribute(name)}
                                  >
                                    <span>{t(name)}</span>
                                    <i>{getDotDisplay(dots)}</i>
                                  </button>
                                )
                              })}
                            </section>
                          ))}
                        </div>

                        {masterRollPoolBeforeLimit > 20 ? <p className="preview-roll-notice">{t('Пул ограничен двадцатью костями.')}</p> : null}
                        {getActivePenaltyDelta(masterRollEffectResult, 'willpower_impairment') ? <p className="preview-roll-notice">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                        {getActivePenaltyDelta(masterRollEffectResult, 'health_impairment') ? <p className="preview-roll-notice">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
                      </>
                    ) : (
                      <p className="panel-empty">{t('Выбери персонажа.')}</p>
                    )}
                  </section>
                </div>
              )}
            </section>
          ) : (
            <JournalPanel
              rightRailTab={rightRailTab}
              journalEntries={journalEntries}
              journalSaveStatus={journalSaveStatus}
              chatUser={chatUser}
              journalSearch={journalSearch}
              filteredJournalEntries={filteredJournalEntries}
              selectedJournalEntry={selectedJournalEntry}
              setJournalSearch={setJournalSearch}
              createJournalEntry={createJournalEntry}
              setSelectedJournalEntryId={setSelectedJournalEntryId}
              updateJournalEntry={updateJournalEntry}
              persistCurrentJournal={persistCurrentJournal}
              deleteJournalEntry={deleteJournalEntry}
              addLayerToJournal={addLayerToJournal}
            />
          )}

          <MasterPanel
            rightRailTab={rightRailTab}
            isMaster={isMaster}
            masterReveals={masterReveals}
            visibleMasterWhispers={visibleMasterWhispers}
            room={room}
            chatUser={chatUser}
            selectedMasterChatUserId={selectedMasterChatUserId}
            masterChatPlayers={masterChatPlayers}
            masterChatDraft={masterChatDraft}
            formatTime={formatTime}
            setSelectedMasterChatUserId={setSelectedMasterChatUserId}
            setMasterChatDraft={setMasterChatDraft}
            sendMasterWhisper={sendMasterWhisper}
          />
        </TableRightPanel>
      </section>

      <OpposedRollModal
        open={Boolean(incomingOpposedProposal)}
        proposal={incomingOpposedProposal}
        activeCharacter={selectedActiveCharacter}
        responseSide={opposedResponseSide}
        responsePool={{
          diceCount: opposedResponsePool.diceCount,
          extraAttributes: opposedResponsePool.extraAttributes,
          extraSkills: opposedResponsePool.extraSkills,
          disciplineNames: opposedResponsePool.disciplineNames,
        }}
        canAnswer={canAnswerOpposedProposal}
        onDismiss={dismissOpposedProposal}
        onAnswer={answerOpposedProposal}
        onResponseSideChange={updateOpposedResponseSide}
      />

      {previewCharacter ? (
        <CharacterPreviewModal
          character={previewCharacter}
          state={{
            tab: previewCharacterTab,
            roll: {
              attribute: previewRollAttribute,
              attributeTwo: previewRollAttributeTwo,
              skill: previewRollSkill,
              discipline: previewRollDiscipline,
              modifier: previewRollModifier,
              mode: previewRollMode,
              contestedOpponentId: previewContestedOpponentId,
              useBloodSurge: previewUseBloodSurge,
            },
            inventory: {
              name: quickInventoryName,
              category: quickInventoryCategory,
              quantity: quickInventoryQuantity,
              status: quickInventoryStatus,
              isBusy: isQuickInventoryBusy,
            },
          }}
          computed={{
            usesVampireResources: previewUsesVampireResources,
            hunger: previewHunger,
            health: previewHealth,
            willpower: previewWillpower,
            humanity: previewHumanity,
            bloodPotency: previewBloodPotency,
            sheetFixed: previewSheetFixed,
            damageProfile: previewDamageProfile,
            healthDerived: previewHealthDerived,
            willpowerDerived: previewWillpowerDerived,
            canRoll: canRollPreview,
            canEditInventory: canEditPreviewInventory,
            canEditActiveEffects: canEditPreviewActiveEffects,
            extraAttributes: previewExtraAttributes,
            extraSkills: previewExtraSkills,
            disciplineNames: previewDisciplineNames,
            diceCount: previewDiceCount,
            poolBeforeLimit: previewPoolBeforeLimit,
            bloodSurgeBonus: previewBloodSurgeBonus,
            bloodSurgeEnabled: previewBloodSurgeEnabled,
            rollEffectResult: previewRollEffectResult,
            contestedOpponentOptions: previewContestedOpponentOptions,
            selectedContestedOpponent: selectedPreviewContestedOpponent,
            willpowerRecoveryPool: getWillpowerRecoveryPool(previewCharacter),
            playerLabel: previewCharacter.username || chatUser?.username || t('Игрок'),
          }}
          actions={{
            onTabChange: setPreviewCharacterTab,
            onClose: () => setPreviewCharacter(null),
            setRollAttribute: setPreviewRollAttribute,
            setRollAttributeTwo: setPreviewRollAttributeTwo,
            setRollSkill: setPreviewRollSkill,
            setRollDiscipline: setPreviewRollDiscipline,
            setRollModifier: setPreviewRollModifier,
            setRollMode: setPreviewRollMode,
            setContestedOpponentId: setPreviewContestedOpponentId,
            setUseBloodSurge: setPreviewUseBloodSurge,
            toggleRollAttribute: togglePreviewAttribute,
            rollPool: rollPreviewPool,
            rollQuickDice: (count, label) => rollQuickDice(count, label, previewCharacter, 'quick', {
              useBloodSurge: previewBloodSurgeEnabled,
              source: previewBloodSurgeEnabled ? 'blood_surge' : 'manual',
            }),
            openDiscipline: openPreviewDiscipline,
            rollRouseCheck: () => rollRouseCheck(previewCharacter),
            setHungerLevel: level => setHungerLevel(previewCharacter, level),
            cycleHealthCell: index => cycleHealthCell(previewCharacter, index),
            cycleWillpowerCell: index => cycleWillpowerCell(previewCharacter, index),
            addHumanityStains: amount => addHumanityStains(previewCharacter, amount),
            removeHumanityStains: amount => removeHumanityStains(previewCharacter, amount),
            performRemorseCheck: () => performRemorseCheck(previewCharacter),
            applyHealthDamage: (amount, severity, options) => applyCharacterHealthDamage(previewCharacter, amount, severity, options),
            promptHealthDamage: () => promptCharacterHealthDamage(previewCharacter),
            recoverHealth: (amount, severity, reason, source) => recoverCharacterHealth(previewCharacter, amount, severity, reason, source),
            mendSuperficial: () => mendVampireSuperficial(previewCharacter),
            mendAggravated: () => mendVampireAggravated(previewCharacter),
            recoverMortalHealth: () => recoverMortalHealth(previewCharacter),
            treatMortalHealth: () => treatMortalHealth(previewCharacter),
            clearHealth: clearPreviewHealth,
            markTorporOrComa: markPreviewTorporOrComa,
            spendWillpower: (amount, reason) => spendWillpower(previewCharacter, amount, reason),
            rollWillpowerCheck: () => rollWillpowerCheck(previewCharacter),
            recoverWillpower: (amount, severity, reason) => recoverWillpower(previewCharacter, amount, severity, reason),
            confirmRecoverAggravatedWillpower: confirmRecoverPreviewAggravatedWillpower,
            adjustWillpowerStress: (severity, delta) => adjustWillpowerStress(previewCharacter, severity, delta),
            removeActiveEffect: removePreviewActiveEffect,
            setQuickInventoryName: setQuickInventoryName,
            setQuickInventoryCategory: setQuickInventoryCategory,
            setQuickInventoryQuantity: setQuickInventoryQuantity,
            addQuickInventoryItem,
            showInventoryItemToMaster,
            onAddExperience: addExperienceToActiveCharacter,
            renderRollModifierControls: result => (
              <RollModifierControls result={result} isMaster={isMaster} setDisabledIds={setDisabledPreviewRollModifierIds} />
            ),
          }}
          isMaster={isMaster}
          isActiveCharacter={previewCharacter.id === selectedActiveCharacter?.id}
          characterSheetHref={characterSheetHref(previewCharacter.id)}
        />
      ) : null}


      <DisciplinePowerPanel
        open={Boolean(previewCharacter && previewDisciplineName)}
        disciplineName={previewDisciplineName}
        openedDisciplineDots={previewOpenedDisciplineDots}
        disciplineRulesStatus={disciplineRulesStatus}
        disciplineRule={previewDisciplineRule}
        disciplinePowers={previewDisciplinePowers}
        selectedPowerName={previewPowerName}
        onSelectPower={setPreviewPowerName}
        selectedPower={selectedPreviewPower}
        selectedPowerRollSummary={selectedPreviewPowerRollSummary}
        selectedPowerDifficultySummary={selectedPreviewPowerDifficultySummary}
        selectedPowerCost={selectedPreviewPowerCost}
        selectedPowerCostLabel={selectedPreviewPowerCostLabel}
        selectedPowerManualPrompts={selectedPreviewPowerManualPrompts}
        selectedPowerInputFields={selectedPreviewPowerInputFields}
        powerInputValues={previewPowerInputValues}
        onPowerInputChange={(fieldId, value) => setPreviewPowerInputValues(current => ({
          ...current,
          [fieldId]: value,
        }))}
        hasMissingPowerInput={hasMissingPreviewPowerInput}
        powerDiceCount={previewPowerDiceCount}
        powerPoolChoices={previewPowerPoolChoices}
        powerPoolSelections={previewPowerPoolSelections}
        onPowerPoolSelectionChange={(index, value) => setPreviewPowerPoolSelections(current => current.map((poolValue, currentIndex) => currentIndex === index ? value : poolValue))}
        powerModifier={previewPowerModifier}
        onPowerModifierChange={setPreviewPowerModifier}
        selectedPowerIsActive={selectedPreviewPowerIsActive}
        selectedPowerIsActiveKind={selectedPreviewPowerIsActiveKind}
        onDeactivatePower={deactivatePreviewDisciplinePower}
        onRollPower={rollPreviewPower}
        canRoll={canRollPreview}
        rollModifierControls={(
          <RollModifierControls
            result={previewPowerRollEffectResult}
            isMaster={isMaster}
            setDisabledIds={setDisabledPreviewPowerModifierIds}
          />
        )}
        powerOpposition={previewPowerOpposition}
        selectedPowerRollFormula={selectedPreviewPowerRollFormula}
        resolvedPowerPool={resolvedPreviewPowerPool}
        hasWillpowerImpairmentPenalty={Boolean(getActivePenaltyDelta(previewPowerRollEffectResult, 'willpower_impairment'))}
        hasHealthImpairmentPenalty={Boolean(getActivePenaltyDelta(previewPowerRollEffectResult, 'health_impairment'))}
        getPoolPartDots={name => previewCharacter ? getCharacterPoolPartDots(previewCharacter, name) : 0}
        onClose={() => setPreviewDisciplineName('')}
      />

      {previewLayer ? (
        <MediaPreviewModal layer={previewLayer} onClose={() => setPreviewLayerId(null)} />
      ) : null}

      {layerContextMenu ? (
        <LayerContextMenuPanel
          layerContextMenu={layerContextMenu}
          layers={layers}
          isMaster={isMaster}
          chatUser={chatUser}
          tableManagerLayers={tableManagerLayers}
          libraryLayers={libraryLayers}
          getContextLayerIds={getContextLayerIds}
          canEditLayer={canEditLayer}
          addLayerToJournal={addLayerToJournal}
          copyLayerForDiary={copyLayerForDiary}
          copyLayerUrl={copyLayerUrl}
          copyLayerToPersonalMedia={copyLayerToPersonalMedia}
          renameLayer={renameLayer}
          openImageEditor={openImageEditor}
          patchLayer={patchLayer}
          patchSelectedLayers={patchSelectedLayers}
          duplicateLayer={duplicateLayer}
          resetLayerCrop={resetLayerCrop}
          reorderLayers={reorderLayers}
          createNamedFolder={createNamedFolder}
          moveLayersToFolder={moveLayersToFolder}
          createFolderForSelection={createFolderForSelection}
          focusLayersForEveryone={focusLayersForEveryone}
          deleteSelectedLayers={deleteSelectedLayers}
          previewLayerOpacity={previewLayerOpacity}
          commitLayerOpacity={commitLayerOpacity}
          setLayerAsBackground={setLayerAsBackground}
          onClose={() => setLayerContextMenu(null)}
        />
      ) : null}

      <MasterPasswordGate
        open={!tableRole}
        masterPasswordDraft={masterPasswordDraft}
        onMasterPasswordDraftChange={setMasterPasswordDraft}
        onEnterAsMaster={enterAsMaster}
        onChoosePlayer={() => chooseTableRole('player')}
      />

      {diceOverlayQueue[0] ? (
        <DiceRollOverlay
          key={diceOverlayQueue[0].id}
          roll={diceOverlayQueue[0]}
          onDone={() => setDiceOverlayQueue(prev => prev.slice(1))}
        />
      ) : null}

      <GameTableStyles />
    </main>
    </RoomMusicStateProvider>
  )
}
