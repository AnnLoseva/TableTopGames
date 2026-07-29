import type { MasterConsoleContribution } from '@/games/vampires/modules/master-console/types'
import { notesSearchProvider } from './search-provider'

export const overviewMasterContribution: MasterConsoleContribution = {
  id: 'overview',
  title: 'Обзор ночи',
  shortTitle: 'Обзор ночи',
  icon: '◈',
  order: 10,
  supportedSystems: ['vtm5'],
  allowedRoles: ['master', 'observer'],
  defaultSize: { width: 1400, height: 900 },
  minSize: { width: 1100, height: 700 },
  singleton: true,
  detachable: true,
  loader: () => import('./components/NightOverviewModule'),
  deepLinks: ['focus'],
  searchProvider: notesSearchProvider,
}
