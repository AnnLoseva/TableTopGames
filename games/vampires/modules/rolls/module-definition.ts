import type { RollsModule } from './types'

export const rollsModuleDefinition: RollsModule = {
  id: 'rolls',
  name: 'Броски',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['rolls'],
}