import { DEFAULT_MASTER_MODULE_ID, getMasterContribution } from '../contributions'
import type { MasterDeepLinkTarget } from './types'
import type { MasterDisplayMode } from '../multi-window/types'

/**
 * Centralized deep-link allowlist.
 * Format: /master?room=<room>&module=<module-id>&entity=<entity-id>
 * Display: &display=detached|primary
 * Layout: &layout=<layout-id|name>
 * Additional params ONLY via this parser (unknown keys dropped on normalize).
 */
export const MASTER_DEEP_LINK_BASE_KEYS = ['room', 'module', 'entity', 'display', 'layout'] as const

/** Extra keys modules may use; must be listed here. */
export const MASTER_DEEP_LINK_EXTRA_KEYS = [
  'entityType',
  'label',
  'kind',
  'focus',
  // Legacy module-specific entity keys (mapped from `entity` when possible)
  'actor',
  'scene',
  'entry',
  'table',
  'bond',
] as const

export type MasterDeepLinkExtraKey = (typeof MASTER_DEEP_LINK_EXTRA_KEYS)[number]

export type ParsedMasterDeepLink = {
  room: string | null
  moduleId: string
  entityId: string | null
  entityType: string | null
  label: string | null
  display: MasterDisplayMode
  layoutId: string | null
  /** Params safe to pass into the active module. */
  moduleParams: Readonly<Record<string, string>>
  /** True when URL had unknown keys that were ignored. */
  droppedKeys: readonly string[]
}

const EXTRA_SET = new Set<string>(MASTER_DEEP_LINK_EXTRA_KEYS)
const BASE_SET = new Set<string>(MASTER_DEEP_LINK_BASE_KEYS)

/** Map entity type → module + primary deep-link param. */
export function resolveEntityNavigation(
  entityType: string | null | undefined,
  fallbackModuleId?: string | null,
): { moduleId: string; param: string } | null {
  switch (entityType) {
    case 'actor':
    case 'npc':
    case 'character':
      return { moduleId: 'actors', param: 'actor' }
    case 'scene':
    case 'layer':
      return { moduleId: 'scenes', param: 'scene' }
    case 'lore':
    case 'lore_entry':
    case 'location':
    case 'plot':
      return { moduleId: 'lore', param: 'entry' }
    case 'random_table':
    case 'table':
      return { moduleId: 'lore', param: 'table' }
    case 'note':
    case 'session_note':
      return { moduleId: 'overview', param: 'focus' }
    case 'session_log':
    case 'session_log_entry':
    case 'journal':
    case 'journal_entry':
      return { moduleId: 'session-log', param: 'entry' }
    case 'blood_bond':
    case 'bond':
      return { moduleId: 'blood-bonds', param: 'bond' }
    case 'action_log':
      return { moduleId: 'overview', param: 'focus' }
    case 'layout':
      return { moduleId: fallbackModuleId || DEFAULT_MASTER_MODULE_ID, param: 'layout' }
    case 'roll':
      return { moduleId: fallbackModuleId || DEFAULT_MASTER_MODULE_ID, param: 'focus' }
    default:
      if (fallbackModuleId && getMasterContribution(fallbackModuleId)) {
        const contrib = getMasterContribution(fallbackModuleId)!
        const param = contrib.deepLinks?.[0] || 'entity'
        return { moduleId: fallbackModuleId, param }
      }
      return null
  }
}

export function parseMasterDeepLink(
  source: string | URLSearchParams | null | undefined,
): ParsedMasterDeepLink {
  const params = typeof source === 'string'
    ? new URLSearchParams(source.startsWith('?') ? source.slice(1) : source)
    : source instanceof URLSearchParams
      ? source
      : typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams()

  const droppedKeys: string[] = []
  for (const key of params.keys()) {
    if (!BASE_SET.has(key) && !EXTRA_SET.has(key)) {
      droppedKeys.push(key)
    }
  }

  const room = params.get('room')
  const rawModule = params.get('module')
  const moduleId = rawModule && getMasterContribution(rawModule)
    ? rawModule
    : DEFAULT_MASTER_MODULE_ID

  const displayRaw = params.get('display')
  const display: MasterDisplayMode = displayRaw === 'detached' ? 'detached' : 'primary'
  const layoutId = params.get('layout')

  const entityType = params.get('entityType') || params.get('kind')
  let entityId = params.get('entity')

  // Legacy: module-specific keys if `entity` missing
  if (!entityId) {
    const contrib = getMasterContribution(moduleId)
    for (const key of contrib?.deepLinks || []) {
      const value = params.get(key)
      if (value) {
        entityId = value
        break
      }
    }
    if (!entityId) {
      for (const key of ['actor', 'scene', 'entry', 'table', 'bond', 'focus'] as const) {
        const value = params.get(key)
        if (value) {
          entityId = value
          break
        }
      }
    }
  }

  const moduleParams: Record<string, string> = {}
  if (entityId) {
    moduleParams.entity = entityId
    const nav = resolveEntityNavigation(entityType, moduleId)
    const contrib = getMasterContribution(moduleId)
    const primaryParam = nav?.param || contrib?.deepLinks?.[0] || 'entity'
    moduleParams[primaryParam] = entityId

    if (entityType === 'random_table' || entityType === 'table' || params.get('table') === entityId) {
      moduleParams.table = entityId
    }
    if (entityType === 'lore' || entityType === 'lore_entry' || params.get('entry') === entityId) {
      moduleParams.entry = entityId
    }
  }

  for (const key of MASTER_DEEP_LINK_EXTRA_KEYS) {
    const value = params.get(key)
    if (value && !moduleParams[key]) moduleParams[key] = value
  }

  if (params.get('label')) moduleParams.label = params.get('label')!
  if (layoutId) moduleParams.layout = layoutId
  if (display === 'detached') moduleParams.display = 'detached'

  return {
    room,
    moduleId,
    entityId,
    entityType,
    label: params.get('label'),
    display,
    layoutId,
    moduleParams,
    droppedKeys,
  }
}

export function applyMasterDeepLinkToUrl(
  target: MasterDeepLinkTarget & {
    room?: string
    display?: MasterDisplayMode
    layoutId?: string | null
  },
  current: URL = typeof window !== 'undefined' ? new URL(window.location.href) : new URL('https://local/master'),
): URL {
  const url = new URL(current.toString())
  if (target.room) url.searchParams.set('room', target.room)

  const moduleId = getMasterContribution(target.moduleId)
    ? target.moduleId
    : DEFAULT_MASTER_MODULE_ID
  url.searchParams.set('module', moduleId)

  for (const key of [...MASTER_DEEP_LINK_EXTRA_KEYS, 'entity']) {
    url.searchParams.delete(key)
  }

  if (target.entityId) {
    url.searchParams.set('entity', target.entityId)
    if (target.entityType) url.searchParams.set('entityType', target.entityType)
    const nav = resolveEntityNavigation(target.entityType, moduleId)
    if (nav) url.searchParams.set(nav.param, target.entityId)
  }

  if (target.display === 'detached') url.searchParams.set('display', 'detached')
  else if (target.display === 'primary') url.searchParams.delete('display')

  if (target.layoutId) url.searchParams.set('layout', target.layoutId)

  if (target.extras) {
    for (const [key, value] of Object.entries(target.extras)) {
      if (!EXTRA_SET.has(key) && key !== 'entity' && key !== 'layout' && key !== 'display') continue
      if (value) url.searchParams.set(key, value)
    }
  }

  return url
}

export function navigateMasterDeepLink(
  target: MasterDeepLinkTarget & {
    room?: string
    display?: MasterDisplayMode
    layoutId?: string | null
  },
): ParsedMasterDeepLink {
  const url = applyMasterDeepLinkToUrl(target)
  // Preserve display/layout from current URL if not specified
  const current = parseMasterDeepLink(typeof window !== 'undefined' ? window.location.search : null)
  if (!target.display && current.display === 'detached') {
    url.searchParams.set('display', 'detached')
  }
  if (target.layoutId === undefined && current.layoutId) {
    url.searchParams.set('layout', current.layoutId)
  }

  const method = target.replace === false ? 'pushState' : 'replaceState'
  window.history[method]({}, '', url.toString())
  const parsed = parseMasterDeepLink(url.searchParams)
  window.dispatchEvent(new CustomEvent('master-console:navigate', {
    detail: {
      moduleId: parsed.moduleId,
      entityId: parsed.entityId,
      entityType: parsed.entityType,
      display: parsed.display,
      layoutId: parsed.layoutId,
      params: parsed.moduleParams,
    },
  }))
  return parsed
}

/** Module params for host — always from central parser. */
export function readModuleDeepLinkParams(moduleId: string): Record<string, string> {
  const parsed = parseMasterDeepLink(
    typeof window !== 'undefined' ? window.location.search : null,
  )
  if (parsed.moduleId !== moduleId && !parsed.entityId) {
    const contrib = getMasterContribution(moduleId)
    const result: Record<string, string> = {}
    for (const key of contrib?.deepLinks || []) {
      if (parsed.moduleParams[key]) result[key] = parsed.moduleParams[key]
    }
    return result
  }
  return { ...parsed.moduleParams }
}
