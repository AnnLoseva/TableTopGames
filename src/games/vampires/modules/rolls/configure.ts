import type { RollsSystemAdapter } from './system-adapter'

let configuredAdapter: RollsSystemAdapter | null = null

/** Wire a game-system adapter into the rolls module (called by Chronicle Hub bootstrap). */
export function configureRollsModule(adapter: RollsSystemAdapter) {
  configuredAdapter = adapter
}

export function isRollsModuleConfigured() {
  return configuredAdapter !== null
}

export function getRollsSystemAdapter(): RollsSystemAdapter {
  if (!configuredAdapter) {
    throw new Error('Rolls module: game system adapter is not configured. Bootstrap via Chronicle Hub first.')
  }
  return configuredAdapter
}

export function resetRollsModuleConfiguration() {
  configuredAdapter = null
}