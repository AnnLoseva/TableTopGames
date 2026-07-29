import type { CharacterSheetModule } from './types'

export const characterSheetModuleDefinition: CharacterSheetModule = {
  id: 'character-sheet',
  name: 'Лист персонажа',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['character-sheet'],
}