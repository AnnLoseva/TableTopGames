import type { ChatModule } from './types'

export const chatModuleDefinition: ChatModule = {
  id: 'chat',
  name: 'Чат',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['chat'],
  persistence: {
    tables: ['table_chat_messages'],
  },
}
