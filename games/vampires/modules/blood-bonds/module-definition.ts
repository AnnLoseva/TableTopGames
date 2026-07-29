import type { BloodBondsModule } from './types'
import { BLOOD_BONDS, BLOOD_BOND_EVENTS } from './constants'
import { MASTER_ACTION_LOG } from '@/games/vampires/modules/master-console/persistence/constants'
import { CHRONICLE_ACTORS } from '@/games/vampires/modules/actors/constants'

export const bloodBondsModuleDefinition: BloodBondsModule = {
  id: 'blood-bonds',
  name: 'Узы крови',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['blood-bonds'],
  persistence: {
    tables: [BLOOD_BONDS, BLOOD_BOND_EVENTS, CHRONICLE_ACTORS, MASTER_ACTION_LOG],
  },
}
