import { DEFAULT_MASTER_MODULE_ID, getMasterContribution } from '../contributions'

/** Business layout state — never window geometry (x/y/w/h). */
export const LAYOUT_SCHEMA_VERSION = 1 as const

export type MasterLayoutStateV1 = {
  schemaVersion: 1
  activeModuleId: string
  /** Optional secondary module ids for future multi-pane; not window positions. */
  secondaryModuleIds: string[]
  /** Human label for second-screen presets */
  label?: string
}

export type MasterLayoutState = MasterLayoutStateV1

export function defaultLayoutState(moduleId?: string): MasterLayoutStateV1 {
  const id = moduleId && getMasterContribution(moduleId) ? moduleId : DEFAULT_MASTER_MODULE_ID
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    activeModuleId: id,
    secondaryModuleIds: [],
  }
}

/**
 * Migrate any stored layout_json to current schema.
 * Unknown versions → best-effort recovery, never throw on empty.
 */
export function migrateLayoutJson(raw: unknown): MasterLayoutStateV1 {
  if (!raw || typeof raw !== 'object') return defaultLayoutState()
  const obj = raw as Record<string, unknown>
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0

  if (version <= 0) {
    // Pre-schema: { activeModuleId?, modules? }
    const active = typeof obj.activeModuleId === 'string' ? obj.activeModuleId : DEFAULT_MASTER_MODULE_ID
    const secondary = Array.isArray(obj.secondaryModuleIds)
      ? obj.secondaryModuleIds.filter((id): id is string => typeof id === 'string')
      : Array.isArray(obj.modules)
        ? (obj.modules as unknown[]).filter((id): id is string => typeof id === 'string')
        : []
    return sanitizeLayoutState({
      schemaVersion: 1,
      activeModuleId: active,
      secondaryModuleIds: secondary,
      label: typeof obj.label === 'string' ? obj.label : undefined,
    })
  }

  if (version === 1) {
    return sanitizeLayoutState({
      schemaVersion: 1,
      activeModuleId: typeof obj.activeModuleId === 'string' ? obj.activeModuleId : DEFAULT_MASTER_MODULE_ID,
      secondaryModuleIds: Array.isArray(obj.secondaryModuleIds)
        ? obj.secondaryModuleIds.filter((id): id is string => typeof id === 'string')
        : [],
      label: typeof obj.label === 'string' ? obj.label : undefined,
    })
  }

  // Future versions: try common fields
  return sanitizeLayoutState({
    schemaVersion: 1,
    activeModuleId: typeof obj.activeModuleId === 'string' ? obj.activeModuleId : DEFAULT_MASTER_MODULE_ID,
    secondaryModuleIds: [],
    label: typeof obj.label === 'string' ? obj.label : `migrated-from-v${version}`,
  })
}

export function sanitizeLayoutState(state: MasterLayoutStateV1): MasterLayoutStateV1 {
  const activeModuleId = getMasterContribution(state.activeModuleId)
    ? state.activeModuleId
    : DEFAULT_MASTER_MODULE_ID
  const secondaryModuleIds = state.secondaryModuleIds
    .filter(id => getMasterContribution(id) && id !== activeModuleId)
    .slice(0, 8)
  return {
    schemaVersion: 1,
    activeModuleId,
    secondaryModuleIds,
    label: state.label,
  }
}

/** Second-screen preset factory (not demo chronicle data). */
export function secondScreenLayoutState(moduleId = 'overview'): MasterLayoutStateV1 {
  return sanitizeLayoutState({
    schemaVersion: 1,
    activeModuleId: moduleId,
    secondaryModuleIds: [],
    label: 'second-screen',
  })
}
