import type { MasterConsoleContribution } from '@/games/vampires/modules/master-console/types'
import { actorsSearchProvider } from './search-provider'

/** Master-console UI contribution for the NPC/SPC module. */
export const actorsMasterContribution: MasterConsoleContribution = {
  id: 'actors',
  title: 'НПС и SPC',
  shortTitle: 'НПС',
  icon: '☾',
  order: 20,
  supportedSystems: ['vtm5'],
  allowedRoles: ['master', 'observer'],
  defaultSize: { width: 1280, height: 820 },
  minSize: { width: 960, height: 560 },
  singleton: true,
  detachable: true,
  loader: () => import('./components/ActorsModule'),
  deepLinks: ['actor'],
  searchProvider: actorsSearchProvider,
}
