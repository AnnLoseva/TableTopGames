import type { ActorsModule } from './types'
import { CHRONICLE_ACTORS, CHRONICLE_ACTOR_PRIVATE } from './constants'
import { CHARACTERS } from '@/games/vampires/modules/table/constants'

export const actorsModuleDefinition: ActorsModule = {
  id: 'actors',
  name: 'Акторы хроники',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['actors'],
  persistence: {
    tables: [CHRONICLE_ACTORS, CHRONICLE_ACTOR_PRIVATE, CHARACTERS],
  },
}
