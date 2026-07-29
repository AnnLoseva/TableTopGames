import type { TableModule } from './types'

export const tableModuleDefinition: TableModule = {
  id: 'table',
  name: 'Стол кампании',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['table', 'media', 'rolls'],
  routes: [{ path: '/table', label: 'Стол' }],
  persistence: {
    tables: ['table_scenes', 'table_images', 'table_rolls', 'table_scene_music', 'characters'],
    buckets: ['table-images', 'table-music'],
  },
}