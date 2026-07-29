import { MASTER_CONSOLE_CONTRIBUTIONS } from '../contributions'
import type { MasterCommand, MasterCommandProvider, MasterSearchProvider, MasterSearchRole } from './types'
import {
  actionLogSearchProvider,
  layoutsSearchProvider,
  rollsSearchProvider,
} from './shell-providers'

/**
 * Collect search providers from module contributions + shell-owned providers.
 * Adding a new module = export searchProvider(s) on its contribution — no shell changes.
 */
export function collectSearchProviders(): readonly MasterSearchProvider[] {
  const fromModules = MASTER_CONSOLE_CONTRIBUTIONS.flatMap(item => {
    if (item.searchProviders?.length) return [...item.searchProviders]
    return item.searchProvider ? [item.searchProvider] : []
  })
  // Shell-owned cross-cutting indexes (not domain modules)
  return [
    ...fromModules,
    actionLogSearchProvider,
    layoutsSearchProvider,
    rollsSearchProvider,
  ]
}

export function collectCommandProviders(): readonly MasterCommandProvider[] {
  return MASTER_CONSOLE_CONTRIBUTIONS.flatMap(item => (
    item.commandProvider ? [item.commandProvider] : []
  ))
}

export async function collectAllCommands(
  ctx: { room: string; role: MasterSearchRole },
  builtIn: readonly MasterCommand[],
): Promise<MasterCommand[]> {
  const providers = collectCommandProviders()
  const nested = await Promise.all(providers.map(provider => provider.getCommands(ctx)))
  const fromModules = nested.flat()
  const byId = new Map<string, MasterCommand>()
  for (const command of [...builtIn, ...fromModules]) {
    if (!command.allowedRoles || command.allowedRoles.includes(ctx.role)) {
      byId.set(command.id, command)
    }
  }
  return [...byId.values()]
}
