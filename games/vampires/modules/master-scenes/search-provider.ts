import { createClient } from '@/games/vampires/lib/supabase'
import type { MasterSearchHit, MasterSearchProvider } from '@/games/vampires/modules/master-console/search/types'
import { haystackMatch } from '@/games/vampires/modules/master-console/search/match'
import { TABLE_IMAGES } from '@/games/vampires/modules/table/constants'
import { loadRoomScenes } from './services/scene-shell-service'

async function searchLayers(room: string, query: string, limit: number): Promise<MasterSearchHit[]> {
  // Light projection only — no image_data blobs.
  const { data, error } = await createClient()
    .from(TABLE_IMAGES)
    .select('id, room, scene_id, layer_type, name, owner_role')
    .eq('room', room)
    .order('created_at', { ascending: false })
    .limit(120)
  if (error) throw error

  const hits: MasterSearchHit[] = []
  for (const row of data || []) {
    const name = typeof row.name === 'string' ? row.name : ''
    const layerType = typeof row.layer_type === 'string' ? row.layer_type : ''
    const m = haystackMatch([name, layerType, row.id], query)
    if (!m) continue
    const sceneId = typeof row.scene_id === 'string' ? row.scene_id : ''
    hits.push({
      id: `layer:${row.id}`,
      title: name || `Слой ${String(row.id).slice(0, 8)}`,
      subtitle: [layerType, sceneId ? `scene ${sceneId.slice(0, 8)}` : 'library'].join(' · '),
      entityType: 'layer',
      moduleId: 'scenes',
      entityId: sceneId || String(row.id),
      icon: '▤',
      isPrivate: row.owner_role === 'master',
      matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
      score: m.score,
      deepLinkKey: 'scene',
    })
  }
  return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
}

export const scenesSearchProvider: MasterSearchProvider = {
  id: 'scenes',
  label: 'Сцены',
  entityTypes: ['scene'],
  allowedRoles: ['master', 'observer'],
  async search({ room, query, limit = 8 }) {
    const scenes = await loadRoomScenes(room)
    const hits: MasterSearchHit[] = []
    for (const scene of scenes) {
      const m = haystackMatch([scene.name, scene.id], query)
      if (!m) continue
      hits.push({
        id: `scene:${scene.id}`,
        title: scene.name,
        subtitle: scene.isActive ? 'активна' : 'черновик',
        entityType: 'scene',
        moduleId: 'scenes',
        entityId: scene.id,
        icon: '▣',
        isPrivate: !scene.isActive,
        matchRanges: m.fieldIndex === 0 ? m.ranges : undefined,
        score: m.score,
        deepLinkKey: 'scene',
      })
    }
    return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  },
}

export const layersSearchProvider: MasterSearchProvider = {
  id: 'layers',
  label: 'Слои',
  entityTypes: ['layer'],
  allowedRoles: ['master'],
  async search({ room, query, limit = 8, role }) {
    if (role !== 'master') return []
    try {
      return await searchLayers(room, query, limit)
    } catch {
      return []
    }
  },
}
