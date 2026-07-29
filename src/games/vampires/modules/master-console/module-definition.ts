import type { MasterConsoleModule } from './types'
import {
  CHRONICLES,
  CHRONICLE_ENTITY_LINKS,
  CHRONICLE_MEMBERS,
  CHRONICLE_SESSIONS,
  MASTER_ACTION_LOG,
  MASTER_LAYOUTS,
  MASTER_MACROS,
} from './persistence/constants'

export const masterConsoleModuleDefinition: MasterConsoleModule = {
  id: 'master-console',
  name: 'Пульт рассказчика',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['master-console'],
  routes: [{ path: '/master', label: 'Пульт рассказчика' }],
  persistence: {
    tables: [
      CHRONICLES,
      CHRONICLE_MEMBERS,
      CHRONICLE_SESSIONS,
      MASTER_LAYOUTS,
      MASTER_MACROS,
      CHRONICLE_ENTITY_LINKS,
      MASTER_ACTION_LOG,
    ],
    localStorageKeys: ['vtm-table-room', 'vtm-table-master-password'],
  },
}
