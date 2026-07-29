import type { HomeModule } from './types'

export const homeModuleDefinition: HomeModule = {
  id: 'home',
  name: 'Главная',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['home'],
  routes: [{ path: '/', label: 'Главная' }],
  persistence: {
    tables: ['users', 'characters'],
    localStorageKeys: [
      'vtm-table-room',
      'vtm-table-role',
      'vtm-chat-user',
      'vtm-sheet-user',
    ],
  },
}
