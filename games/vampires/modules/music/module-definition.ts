import type { MusicModule } from './types'

export const musicModuleDefinition: MusicModule = {
  id: 'music',
  name: 'Музыка',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['music'],
  persistence: {
    tables: ['table_music', 'table_music_library', 'table_scene_music'],
    buckets: ['table-music'],
  },
}
