import type { TableSystemAdapter } from './system-adapter'

let configuredAdapter: TableSystemAdapter | null = null

/** Wire a game-system adapter into the table module (called by Chronicle Hub bootstrap). */
export function configureTableModule(adapter: TableSystemAdapter) {
  configuredAdapter = adapter
}

export function isTableModuleConfigured() {
  return configuredAdapter !== null
}

export function getTableSystemAdapter(): TableSystemAdapter {
  if (!configuredAdapter) {
    throw new Error('Table module: game system adapter is not configured. Bootstrap via Chronicle Hub first.')
  }
  return configuredAdapter
}

export function resetTableModuleConfiguration() {
  configuredAdapter = null
}