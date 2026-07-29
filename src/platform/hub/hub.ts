import { createHubRegistry } from './registry'
import type { ChronicleHub } from './types'
import type { GameSystem, ModuleRegistration } from './types'

export type CreateChronicleHubOptions = {
  systems?: readonly GameSystem[]
  modules?: readonly ModuleRegistration[]
}

/**
 * Thin chronicle hub: registers game systems and feature modules, then resolves
 * which modules apply to a given chronicle. Real orchestration (routing, DI, etc.)
 * will be layered on top of this foundation later.
 */
export function createChronicleHub(options: CreateChronicleHubOptions = {}): ChronicleHub {
  const registry = createHubRegistry()

  for (const system of options.systems ?? []) {
    registry.registerGameSystem(system)
  }

  for (const registration of options.modules ?? []) {
    registry.registerModule(registration)
  }

  return {
    registerGameSystem: registry.registerGameSystem,
    registerModule: registry.registerModule,
    getGameSystem: registry.getGameSystem,
    getModuleRegistration: registry.getModuleRegistration,
    listGameSystems: registry.listGameSystems,
    listModuleRegistrations: registry.listModuleRegistrations,
    resolveModulesForChronicle: registry.resolveModulesForChronicle,
  }
}