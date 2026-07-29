export type GameSystemId = 'vtm5' | (string & {})

export type ModuleId =
  | 'home'
  | 'table'
  | 'chat'
  | 'music'
  | 'rolls'
  | 'character-sheet'
  | 'journal'
  | 'reference'
  | 'master-console'
  | 'master-rolls'
  | 'master-overview'
  | 'master-scenes'
  | 'lore'
  | 'blood-bonds'
  | 'session-log'
  | 'actors'
  | (string & {})

export type ChronicleRole = 'master' | 'player' | 'observer'

export type ModuleLifecycle = 'planned' | 'active' | 'legacy-bridge' | 'deprecated'

export type ModuleCapability =
  | 'home'
  | 'table'
  | 'chat'
  | 'music'
  | 'rolls'
  | 'character-sheet'
  | 'journal'
  | 'reference'
  | 'media'
  | 'rules'
  | 'master-console'
  | 'master-rolls'
  | 'master-overview'
  | 'master-scenes'
  | 'lore'
  | 'blood-bonds'
  | 'session-log'
  | 'actors'
  | (string & {})

export type ModuleRoute = {
  path: string
  label: string
}

export type ModulePersistenceContract = {
  tables?: readonly string[]
  buckets?: readonly string[]
  localStorageKeys?: readonly string[]
}

export type BrowserContract = {
  postMessages?: readonly string[]
  windowEvents?: readonly string[]
  globals?: readonly string[]
}

export type GameSystem<TId extends GameSystemId = GameSystemId> = {
  id: TId
  name: string
  version?: string
  rulesNamespace: string
}

export type Module<
  TId extends ModuleId = ModuleId,
  TSystemId extends GameSystemId = GameSystemId,
> = {
  id: TId
  name: string
  lifecycle: ModuleLifecycle
  supportedSystems: readonly TSystemId[]
  capabilities: readonly ModuleCapability[]
  routes?: readonly ModuleRoute[]
  persistence?: ModulePersistenceContract
  browser?: BrowserContract
}

export type ChronicleMember = {
  id: string
  displayName: string
  role: ChronicleRole
}

export type Chronicle<TSystemId extends GameSystemId = GameSystemId> = {
  id: string
  name: string
  systemId: TSystemId
  roomId: string
  members?: readonly ChronicleMember[]
}

/** Binds a module definition to the hub registry (enablement, future per-chronicle overrides). */
export type ModuleRegistration<
  TId extends ModuleId = ModuleId,
  TSystemId extends GameSystemId = GameSystemId,
> = {
  module: Module<TId, TSystemId>
  /** Included in resolveModulesForChronicle when true or omitted. Default: true. */
  enabledByDefault?: boolean
}

/** Modules resolved for a chronicle: filtered by game system and registration flags. */
export type ResolvedChronicleModules<TSystemId extends GameSystemId = GameSystemId> = {
  chronicle: Chronicle<TSystemId>
  system: GameSystem<TSystemId>
  modules: readonly Module<ModuleId, TSystemId>[]
}

export type ChronicleHub = {
  registerGameSystem: (system: GameSystem) => void
  registerModule: (registration: ModuleRegistration) => void
  getGameSystem: (systemId: GameSystemId) => GameSystem | undefined
  getModuleRegistration: (moduleId: ModuleId) => ModuleRegistration | undefined
  listGameSystems: () => readonly GameSystem[]
  listModuleRegistrations: () => readonly ModuleRegistration[]
  resolveModulesForChronicle: (chronicle: Chronicle) => ResolvedChronicleModules
}
