import type { MasterConsoleContribution } from '@/games/vampires/modules/master-console/types'
import { loreSearchProvider, randomTablesSearchProvider } from './search-provider'

export const loreMasterContribution: MasterConsoleContribution = {
  id: 'lore',
  title: 'Лор и таблицы',
  shortTitle: 'Лор и таблицы',
  icon: '✎',
  order: 40,
  supportedSystems: ['vtm5'],
  allowedRoles: ['master', 'observer'],
  defaultSize: { width: 1400, height: 900 },
  minSize: { width: 1100, height: 700 },
  singleton: true,
  detachable: true,
  loader: () => import('./components/LoreModule'),
  deepLinks: ['entry', 'table'],
  searchProviders: [loreSearchProvider, randomTablesSearchProvider],
}
