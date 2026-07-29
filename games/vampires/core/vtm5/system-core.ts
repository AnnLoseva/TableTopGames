import { createVtm5RollsAdapter } from './adapters/rolls'
import { createVtm5TableAdapter } from './adapters/table'
import type { Vtm5System } from './types'
import type { RollsSystemAdapter } from '@/games/vampires/modules/rolls/system-adapter'
import type { TableSystemAdapter } from '@/games/vampires/modules/table/system-adapter'

export type Vtm5ModuleAdapters = {
  table: TableSystemAdapter
  rolls: RollsSystemAdapter
}

export type Vtm5SystemCore = {
  system: Vtm5System
  adapters: Vtm5ModuleAdapters
}

const VTM5_SYSTEM: Vtm5System = {
  id: 'vtm5',
  name: 'Vampire: The Masquerade 5th Edition',
  version: '5.0',
  rulesNamespace: 'vtm5',
}

/** VTM5 Core: game system metadata + module adapters backed by pure rules in rules/*. */
export function createVtm5SystemCore(): Vtm5SystemCore {
  return {
    system: VTM5_SYSTEM,
    adapters: {
      table: createVtm5TableAdapter(),
      rolls: createVtm5RollsAdapter(),
    },
  }
}