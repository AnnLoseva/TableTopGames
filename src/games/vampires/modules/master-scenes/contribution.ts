import type { MasterConsoleContribution } from '@/games/vampires/modules/master-console/types'
import { layersSearchProvider, scenesSearchProvider } from './search-provider'

export const scenesMasterContribution: MasterConsoleContribution = {
  id: 'scenes',
  title: 'Сцены и слои',
  shortTitle: 'Сцены и слои',
  icon: '▣',
  order: 30,
  supportedSystems: ['vtm5'],
  allowedRoles: ['master', 'observer'],
  defaultSize: { width: 1440, height: 900 },
  minSize: { width: 1100, height: 700 },
  singleton: true,
  detachable: true,
  loader: () => import('./components/MasterScenesModule'),
  deepLinks: ['scene'],
  searchProviders: [scenesSearchProvider, layersSearchProvider],
}
