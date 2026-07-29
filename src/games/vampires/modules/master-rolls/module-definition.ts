import type { MasterRollsModule } from './types'
import { MASTER_HIDDEN_ROLLS } from './constants'
import { TABLE_ROLLS } from '@/games/vampires/modules/table/constants'
import { MASTER_ACTION_LOG } from '@/games/vampires/modules/master-console/persistence/constants'

export const masterRollsModuleDefinition: MasterRollsModule = {
  id: 'master-rolls',
  name: 'Роллер мастера',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['master-rolls'],
  persistence: {
    tables: [MASTER_HIDDEN_ROLLS, TABLE_ROLLS, MASTER_ACTION_LOG],
  },
}
