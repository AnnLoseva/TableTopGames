'use client'

import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { edgeStrokeWidth, fitViewBox } from '../utils/graph-layout'
import type { GraphEdge, GraphNode } from '../types'

type BondGraphProps = {
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
  selectedBondId: string | null
  selectedActorId: string | null
  onSelectBond: (bondId: string) => void
  onSelectActor: (actorId: string | null) => void
}

export default function BondGraph({
  nodes,
  edges,
  selectedBondId,
  selectedActorId,
  onSelectBond,
  onSelectActor,
}: BondGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const base = useMemo(() => fitViewBox(nodes), [nodes])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const viewBox = useMemo(() => {
    const width = base.width / zoom
    const height = base.height / zoom
    const minX = base.minX + (base.width - width) / 2 - pan.x
    const minY = base.minY + (base.height - height) / 2 - pan.y
    return `${minX} ${minY} ${width} ${height}`
  }, [base, pan.x, pan.y, zoom])

  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes])

  const relatedIds = useMemo(() => {
    if (!selectedActorId) return null
    const set = new Set<string>([selectedActorId])
    for (const edge of edges) {
      if (edge.source === selectedActorId || edge.target === selectedActorId) {
        set.add(edge.source)
        set.add(edge.target)
      }
    }
    return set
  }, [edges, selectedActorId])

  const onWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.4, Math.min(3.5, prev * delta)))
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if ((event.target as Element).closest('.bb-node, .bb-edge-hit')) return
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  }, [pan.x, pan.y])

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    if (!drag.current) return
    const scale = base.width / (svgRef.current?.clientWidth || base.width)
    setPan({
      x: drag.current.panX + (event.clientX - drag.current.x) * scale / zoom,
      y: drag.current.panY + (event.clientY - drag.current.y) * scale / zoom,
    })
  }, [base.width, zoom])

  const onPointerUp = useCallback(() => {
    drag.current = null
  }, [])

  const fit = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  return (
    <div className="bb-graph-wrap" aria-label="Граф уз крови">
      <div className="bb-toolbar" style={{ position: 'absolute', right: 10, top: 10, zIndex: 2 }}>
        <button type="button" className="bb-btn" onClick={() => setZoom(z => Math.min(3.5, z * 1.15))}>+</button>
        <button type="button" className="bb-btn" onClick={() => setZoom(z => Math.max(0.4, z / 1.15))}>−</button>
        <button type="button" className="bb-btn" onClick={fit}>fit</button>
      </div>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        role="img"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <marker id="bb-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vtm-blood)" />
          </marker>
        </defs>

        {edges.map(edge => {
          const from = nodeById.get(edge.source)
          const to = nodeById.get(edge.target)
          if (!from || !to) return null
          const dim = Boolean(relatedIds && !relatedIds.has(edge.source) && !relatedIds.has(edge.target))
          const mx = (from.x + to.x) / 2
          const my = (from.y + to.y) / 2
          // Shorten line so arrow doesn't sit under node
          const dx = to.x - from.x
          const dy = to.y - from.y
          const len = Math.hypot(dx, dy) || 1
          const pad = 22
          const x1 = from.x + (dx / len) * pad
          const y1 = from.y + (dy / len) * pad
          const x2 = to.x - (dx / len) * pad
          const y2 = to.y - (dy / len) * pad
          return (
            <g key={edge.id}>
              <line
                className="bb-edge-hit"
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth={14}
                onClick={event => {
                  event.stopPropagation()
                  onSelectBond(edge.bondId)
                }}
              />
              <line
                className="bb-edge"
                data-selected={selectedBondId === edge.bondId ? 'true' : undefined}
                data-dim={dim ? 'true' : undefined}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={edgeStrokeWidth(edge.level)}
                markerEnd="url(#bb-arrow)"
                onClick={event => {
                  event.stopPropagation()
                  onSelectBond(edge.bondId)
                }}
              />
              <text className="bb-edge-label" x={mx} y={my - 6}>{edge.level}</text>
            </g>
          )
        })}

        {nodes.map(node => {
          const highlight = relatedIds?.has(node.id)
          const selected = selectedActorId === node.id
          const dim = Boolean(relatedIds && !highlight)
          return (
            <g
              key={node.id}
              className="bb-node"
              data-pc={node.isPc ? 'true' : undefined}
              data-selected={selected ? 'true' : undefined}
              data-highlight={highlight ? 'true' : undefined}
              transform={`translate(${node.x}, ${node.y})`}
              opacity={dim ? 0.25 : 1}
              onClick={event => {
                event.stopPropagation()
                onSelectActor(selectedActorId === node.id ? null : node.id)
              }}
            >
              <circle r={node.isPc ? 18 : 14} />
              <text y={4}>{node.label.slice(0, 10)}</text>
              <title>{node.label}{node.isPc ? ' (PC)' : ''}</title>
            </g>
          )
        })}
      </svg>
      <div className="bb-legend">
        <span>PC — зелёное кольцо</span>
        <span>ребро thrall → regnant</span>
        <span>цифра = уровень</span>
      </div>
    </div>
  )
}
