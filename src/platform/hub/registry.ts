import type {
  Chronicle,
  GameSystem,
  GameSystemId,
  Module,
  ModuleId,
  ModuleRegistration,
  ResolvedChronicleModules,
} from './types'

export type HubRegistry = {
  registerGameSystem: (system: GameSystem) => void
  registerModule: (registration: ModuleRegistration) => void
  getGameSystem: (systemId: GameSystemId) => GameSystem | undefined
  getModuleRegistration: (moduleId: ModuleId) => ModuleRegistration | undefined
  listGameSystems: () => readonly GameSystem[]
  listModuleRegistrations: () => readonly ModuleRegistration[]
  resolveModulesForChronicle: (chronicle: Chronicle) => ResolvedChronicleModules
}

function isModuleEnabledForChronicle(registration: ModuleRegistration) {
  return registration.enabledByDefault !== false
}

function supportsChronicleSystem(
  module: Module,
  systemId: GameSystemId,
): module is Module<ModuleId, typeof systemId> {
  return (module.supportedSystems as readonly GameSystemId[]).includes(systemId)
}

export function createHubRegistry(): HubRegistry {
  const systems = new Map<GameSystemId, GameSystem>()
  const modules = new Map<ModuleId, ModuleRegistration>()

  return {
    registerGameSystem(system) {
      systems.set(system.id, system)
    },

    registerModule(registration) {
      modules.set(registration.module.id, registration)
    },

    getGameSystem(systemId) {
      return systems.get(systemId)
    },

    getModuleRegistration(moduleId) {
      return modules.get(moduleId)
    },

    listGameSystems() {
      return [...systems.values()].sort((a, b) => a.id.localeCompare(b.id))
    },

    listModuleRegistrations() {
      return [...modules.values()].sort((a, b) => a.module.id.localeCompare(b.module.id))
    },

    resolveModulesForChronicle(chronicle) {
      const system = systems.get(chronicle.systemId)
      if (!system) {
        throw new Error(`Game system "${chronicle.systemId}" is not registered in the hub`)
      }

      const resolvedModules = [...modules.values()]
        .filter(registration => isModuleEnabledForChronicle(registration))
        .filter(registration => supportsChronicleSystem(registration.module, chronicle.systemId))
        .map(registration => registration.module)
        .sort((a, b) => a.id.localeCompare(b.id))

      return {
        chronicle,
        system: system as GameSystem<typeof chronicle.systemId>,
        modules: resolvedModules as Module<ModuleId, typeof chronicle.systemId>[],
      }
    },
  }
}