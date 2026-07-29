import type { MasterScenesModule } from './types'
import {
  MASTER_SCENE_META,
  MASTER_SCENE_OBJECTS,
  MASTER_SCENE_OBJECTS_PUBLIC,
} from './constants'
import { TABLE_IMAGES, TABLE_SCENE_MUSIC, TABLE_SCENES } from '@/games/vampires/modules/table/constants'
import { TABLE_MUSIC } from '@/games/vampires/modules/music/utils'

export const masterScenesModuleDefinition: MasterScenesModule = {
  id: 'master-scenes',
  name: 'Сцены и слои',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['master-scenes'],
  persistence: {
    tables: [
      TABLE_SCENES,
      TABLE_IMAGES,
      TABLE_SCENE_MUSIC,
      TABLE_MUSIC,
      MASTER_SCENE_META,
      MASTER_SCENE_OBJECTS,
      MASTER_SCENE_OBJECTS_PUBLIC,
    ],
  },
}
