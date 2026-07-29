import type { MasterConsoleContribution } from '@/games/vampires/modules/master-console/types'
import { bloodBondsSearchProvider } from './search-provider'

export const bloodBondsMasterContribution: MasterConsoleContribution = {
  id: 'blood-bonds',
  title: 'Узы крови',
  shortTitle: 'Узы крови',
  icon: '∞',
  order: 50,
  supportedSystems: ['vtm5'],
  allowedRoles: ['master', 'observer'],
  defaultSize: { width: 1400, height: 900 },
  minSize: { width: 1100, height: 700 },
  singleton: true,
  detachable: true,
  loader: () => import('./components/BloodBondsModule'),
  deepLinks: ['bond'],
  searchProvider: bloodBondsSearchProvider,
}
