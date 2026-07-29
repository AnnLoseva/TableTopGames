import type { BloodBond } from '../types'
import type { GraphEdge, GraphNode } from '../types'

export type LayoutActor = {
  id: string
  label: string
  isPc: boolean
}

/**
 * Stable layout: sort actor ids, place PCs on outer ring, others on inner ring.
 * Deterministic between renders (no random). Works well up to 50+ nodes.
 */
export function layoutBondGraph(
  actors: readonly LayoutActor[],
  bonds: readonly BloodBond[],
  size = 640,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = size / 2
  const cy = size / 2
  const involved = new Set<string>()
  for (const bond of bonds) {
    if (bond.status === 'broken') continue
    involved.add(bond.thrallActorId)
    involved.add(bond.regnantActorId)
  }

  // Always include all provided actors so empty graph still shows cast.
  const list = [...actors].sort((a, b) => {
    if (a.isPc !== b.isPc) return a.isPc ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  const pcs = list.filter(actor => actor.isPc)
  const npcs = list.filter(actor => !actor.isPc)
  const outerR = size * 0.38
  const innerR = size * 0.22

  const nodes: GraphNode[] = []
  const place = (subset: LayoutActor[], radius: number, phase = 0) => {
    const n = Math.max(1, subset.length)
    subset.forEach((actor, index) => {
      const angle = phase + (Math.PI * 2 * index) / n - Math.PI / 2
      nodes.push({
        id: actor.id,
        label: actor.label,
        isPc: actor.isPc,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      })
    })
  }

  if (pcs.length) place(pcs, outerR, 0)
  if (npcs.length) place(npcs, npcs.length === 1 && !pcs.length ? 0 : innerR, Math.PI / nAngle(npcs.length))

  // Single node alone at center
  if (nodes.length === 1) {
    nodes[0].x = cx
    nodes[0].y = cy
  }

  const edges: GraphEdge[] = bonds
    .filter(bond => bond.status !== 'broken')
    .map(bond => ({
      id: bond.id,
      bondId: bond.id,
      // Direction thrall → regnant
      source: bond.thrallActorId,
      target: bond.regnantActorId,
      level: bond.level,
      status: bond.status,
    }))

  return { nodes, edges }
}

function nAngle(n: number) {
  return n > 0 ? Math.PI / n : 0
}

export function edgeStrokeWidth(level: number): number {
  return 1.5 + Math.max(1, Math.min(3, level)) * 1.75
}

export function fitViewBox(
  nodes: readonly GraphNode[],
  padding = 48,
): { minX: number; minY: number; width: number; height: number } {
  if (!nodes.length) return { minX: 0, minY: 0, width: 640, height: 640 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x)
    maxY = Math.max(maxY, node.y)
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(120, maxX - minX + padding * 2),
    height: Math.max(120, maxY - minY + padding * 2),
  }
}
