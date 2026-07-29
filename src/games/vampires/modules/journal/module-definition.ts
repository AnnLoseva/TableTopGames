import type { JournalModule } from './types'

export const journalModuleDefinition: JournalModule = {
  id: 'journal',
  name: 'Журнал',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['journal'],
}