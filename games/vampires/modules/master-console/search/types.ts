/** Search / command / deep-link contracts for master-console shell. */

export type MasterSearchRole = 'master' | 'observer' | 'player'

export type MasterSearchEntityType =
  | 'actor'
  | 'scene'
  | 'layer'
  | 'lore'
  | 'random_table'
  | 'note'
  | 'session_log'
  | 'blood_bond'
  | 'roll'
  | 'action_log'
  | 'layout'
  | 'module'
  | 'macro'
  | 'command'

export type MasterSearchMatchRange = {
  start: number
  end: number
}

export type MasterSearchHit = {
  id: string
  title: string
  subtitle?: string
  entityType: MasterSearchEntityType
  moduleId: string
  entityId: string
  icon?: string
  /** Badge only — providers for non-master roles must not return private rows. */
  isPrivate?: boolean
  matchRanges?: readonly MasterSearchMatchRange[]
  score?: number
  /** Optional secondary deep-link param key (e.g. table vs entry for lore). */
  deepLinkKey?: string
}

export type MasterSearchContext = {
  room: string
  role: MasterSearchRole
  query: string
  signal?: AbortSignal
  limit?: number
}

/**
 * Module-owned search provider. Shell only fans out — no knowledge of tables.
 * Implementations must filter by room and role server-side / at the API boundary,
 * never "fetch all private then hide on player client".
 */
export type MasterSearchProvider = {
  id: string
  label: string
  entityTypes: readonly MasterSearchEntityType[]
  allowedRoles: readonly MasterSearchRole[]
  search: (ctx: MasterSearchContext) => Promise<readonly MasterSearchHit[]>
}

export type MasterDeepLinkTarget = {
  moduleId: string
  entityId?: string | null
  entityType?: string | null
  /** Extra allow-listed params only. */
  extras?: Readonly<Record<string, string>>
  replace?: boolean
}

export type MasterCommandContext = {
  room: string
  role: MasterSearchRole
  navigate: (target: MasterDeepLinkTarget) => void
  openRoller: () => void
  confirm: (message: string) => Promise<boolean>
  setStatus?: (message: string) => void
  reload?: () => void
}

export type MasterCommand = {
  id: string
  title: string
  subtitle?: string
  keywords?: readonly string[]
  group: string
  icon?: string
  dangerous?: boolean
  confirmMessage?: string
  allowedRoles?: readonly MasterSearchRole[]
  run: (ctx: MasterCommandContext) => void | Promise<void>
}

export type MasterCommandProvider = {
  id: string
  getCommands: (
    ctx: Pick<MasterCommandContext, 'room' | 'role'>,
  ) => readonly MasterCommand[] | Promise<readonly MasterCommand[]>
}

export type MasterSearchGroup = {
  id: string
  label: string
  hits: readonly MasterSearchHit[]
}

export type PaletteItem =
  | { kind: 'hit'; hit: MasterSearchHit }
  | { kind: 'command'; command: MasterCommand }
  | { kind: 'recent'; hit: MasterSearchHit }
