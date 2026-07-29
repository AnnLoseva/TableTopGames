import type { SessionLogModule } from './types'
import { SESSION_LOG_ENTRIES, SESSION_LOG_PUBLISHED } from './constants'
import { MASTER_ACTION_LOG, CHRONICLE_ENTITY_LINKS } from '@/games/vampires/modules/master-console/persistence/constants'

export const sessionLogModuleDefinition: SessionLogModule = {
  id: 'session-log',
  name: 'Журнал сессии',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['session-log'],
  persistence: {
    tables: [
      SESSION_LOG_ENTRIES,
      SESSION_LOG_PUBLISHED,
      MASTER_ACTION_LOG,
      CHRONICLE_ENTITY_LINKS,
    ],
    // Never use vtm-journal:* — that is the player diary.
    localStorageKeys: [
      'vtm-session-log:*',
      'vtm-session-log-published:*',
    ],
  },
}
