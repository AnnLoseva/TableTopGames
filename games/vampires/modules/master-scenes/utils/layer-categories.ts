import type { TableLayer } from '@/games/vampires/modules/table/types'
import type { LayerCategory } from '../types'

const FOG_RE = /fog|туман|mask|maskarad|war\s*fog|foW/i

/** Map existing layers into GM / fog / players without a second engine. */
export function categorizeLayer(layer: TableLayer): LayerCategory {
  if (FOG_RE.test(layer.name) || FOG_RE.test(layer.layerType)) return 'fog'
  if (layer.ownerRole === 'master') return 'gm'
  return 'players'
}

export function groupLayersByCategory(layers: readonly TableLayer[]) {
  const groups: Record<LayerCategory, TableLayer[]> = {
    gm: [],
    fog: [],
    players: [],
  }
  for (const layer of layers) {
    groups[categorizeLayer(layer)].push(layer)
  }
  return groups
}

export const LAYER_CATEGORY_LABELS: Record<LayerCategory, string> = {
  gm: 'GM-слой',
  fog: 'Туман войны',
  players: 'Игрокам',
}
