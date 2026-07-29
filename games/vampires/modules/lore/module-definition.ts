import type { LoreModule } from './types'
import {
  CHRONICLE_LORE_CATEGORIES,
  CHRONICLE_LORE_ENTRIES,
  CHRONICLE_LORE_ENTRY_PRIVATE,
  CHRONICLE_RANDOM_TABLES,
} from './constants'
import { CHRONICLE_ENTITY_LINKS, MASTER_ACTION_LOG } from '@/games/vampires/modules/master-console/persistence/constants'

export const loreModuleDefinition: LoreModule = {
  id: 'lore',
  name: 'Лор и таблицы',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['lore'],
  persistence: {
    tables: [
      CHRONICLE_LORE_CATEGORIES,
      CHRONICLE_LORE_ENTRIES,
      CHRONICLE_LORE_ENTRY_PRIVATE,
      CHRONICLE_RANDOM_TABLES,
      CHRONICLE_ENTITY_LINKS,
      MASTER_ACTION_LOG,
    ],
  },
}
