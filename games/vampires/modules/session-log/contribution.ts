import type { MasterConsoleContribution } from '@/games/vampires/modules/master-console/types'
import { sessionLogSearchProvider } from './search-provider'

export const sessionLogMasterContribution: MasterConsoleContribution = {
  id: 'session-log',
  title: 'Журнал сессии',
  shortTitle: 'Журнал сессии',
  icon: '☰',
  order: 60,
  supportedSystems: ['vtm5'],
  allowedRoles: ['master', 'observer'],
  defaultSize: { width: 1400, height: 900 },
  minSize: { width: 1100, height: 700 },
  singleton: true,
  detachable: true,
  loader: () => import('./components/SessionLogModule'),
  deepLinks: ['entry'],
  searchProvider: sessionLogSearchProvider,
}
