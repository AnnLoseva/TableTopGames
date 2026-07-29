import { createVtm5SystemCore } from '@/games/vampires/core/vtm5'
import { configureRollsModule } from '@/games/vampires/modules/rolls/configure'
import type { RollsSystemAdapter } from '@/games/vampires/modules/rolls/system-adapter'
import { configureTableModule } from '@/games/vampires/modules/table/configure'
import type { TableSystemAdapter } from '@/games/vampires/modules/table/system-adapter'
import type {
  Chronicle,
  ChronicleHub,
  GameSystemId,
  ResolvedChronicleModules,
} from '@/core/hub'

export type WiredModuleAdapters = {
  table?: TableSystemAdapter
  rolls?: RollsSystemAdapter
}

/** Chronicle bootstrapped with resolved modules and game-system adapters wired in. */
export type ChronicleRuntime<TSystemId extends GameSystemId = GameSystemId> = {
  chronicle: Chronicle<TSystemId>
  resolved: ResolvedChronicleModules<TSystemId>
  adapters: WiredModuleAdapters
}

function wireModuleAdapters(
  moduleIds: readonly string[],
  adapters: WiredModuleAdapters,
) {
  if (moduleIds.includes('table') && adapters.table) {
    configureTableModule(adapters.table)
  }
  if (moduleIds.includes('rolls') && adapters.rolls) {
    configureRollsModule(adapters.rolls)
  }
}

/**
 * Resolves chronicle modules via Hub, loads the matching game system core,
 * and passes adapters into feature modules. Simplified static wiring — no DI container yet.
 */
export function bootstrapChronicleRuntime(
  hub: ChronicleHub,
  chronicle: Chronicle,
): ChronicleRuntime {
  const resolved = hub.resolveModulesForChronicle(chronicle)
  const moduleIds = resolved.modules.map(module => module.id)

  if (chronicle.systemId === 'vtm5') {
    const vtm5 = createVtm5SystemCore()
    const adapters: WiredModuleAdapters = {
      table: vtm5.adapters.table,
      rolls: vtm5.adapters.rolls,
    }
    wireModuleAdapters(moduleIds, adapters)
    return { chronicle, resolved, adapters }
  }

  throw new Error(`Chronicle bootstrap: game system "${chronicle.systemId}" is not supported yet`)
}
