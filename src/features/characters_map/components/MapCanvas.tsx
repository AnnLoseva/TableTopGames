'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapCharacter, MapRelationship } from '../types'
import styles from './MapCanvas.module.css'

const NODE_RADIUS = 40
const ARROW_LENGTH = 11
const EDGE_OFFSET_STEP = 34
const CLICK_DRAG_THRESHOLD = 5
const MIN_SCALE = 0.25
const MAX_SCALE = 2.5

type View = { x: number; y: number; scale: number }

type Point = { x: number; y: number }

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

function length(v: Point): number {
  return Math.hypot(v.x, v.y) || 1
}

function normalize(v: Point): Point {
  const len = length(v)
  return { x: v.x / len, y: v.y / len }
}

function pointAt(a: Point, dir: Point, distance: number): Point {
  return { x: a.x + dir.x * distance, y: a.y + dir.y * distance }
}

type Edge = {
  relationship: MapRelationship
  from: MapCharacter
  to: MapCharacter
  offset: number
}

function buildEdges(characters: MapCharacter[], relationships: MapRelationship[]): Edge[] {
  const byId = new Map(characters.map(character => [character.id, character]))
  const groups = new Map<string, MapRelationship[]>()
  for (const relationship of relationships) {
    if (!byId.has(relationship.fromCharacterId) || !byId.has(relationship.toCharacterId)) continue
    const key = pairKey(relationship.fromCharacterId, relationship.toCharacterId)
    const group = groups.get(key)
    if (group) group.push(relationship)
    else groups.set(key, [relationship])
  }

  const edges: Edge[] = []
  for (const group of groups.values()) {
    const count = group.length
    group.forEach((relationship, index) => {
      const offset = (index - (count - 1) / 2) * EDGE_OFFSET_STEP
      const from = byId.get(relationship.fromCharacterId)
      const to = byId.get(relationship.toCharacterId)
      if (!from || !to) return
      edges.push({ relationship, from, to, offset })
    })
  }
  return edges
}

function edgeGeometry(from: MapCharacter, to: MapCharacter, offset: number) {
  const a: Point = { x: from.positionX, y: from.positionY }
  const b: Point = { x: to.positionX, y: to.positionY }
  const mid: Point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  if (offset !== 0) {
    const perp = normalize({ x: -(b.y - a.y), y: b.x - a.x })
    mid.x += perp.x * offset
    mid.y += perp.y * offset
  }
  const startDir = normalize(subtract(mid, a))
  const endDir = normalize(subtract(b, mid))
  return {
    start: pointAt(a, startDir, NODE_RADIUS),
    control: mid,
    end: pointAt(b, endDir, -NODE_RADIUS),
    endDir,
  }
}

function quadraticAt(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

type Props = {
  characters: MapCharacter[]
  relationships: MapRelationship[]
  isEditor: boolean
  selectedCharacterId: string | null
  selectedRelationshipId: string | null
  onSelectCharacter: (id: string | null) => void
  onSelectRelationship: (id: string | null) => void
  onMoveCharacter: (id: string, x: number, y: number) => void
  getImageUrl: (imagePath: string) => string
}

export default function MapCanvas({
  characters,
  relationships,
  isEditor,
  selectedCharacterId,
  selectedRelationshipId,
  onSelectCharacter,
  onSelectRelationship,
  onMoveCharacter,
  getImageUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const hasCenteredRef = useRef(false)
  const [isPanning, setIsPanning] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverride, setDragOverride] = useState<Point | null>(null)
  const dragState = useRef<{
    kind: 'pan' | 'node'
    startClientX: number
    startClientY: number
    startViewX: number
    startViewY: number
    nodeId?: string
    nodeStartX?: number
    nodeStartY?: number
    moved: boolean
  } | null>(null)

  const edges = useMemo(() => buildEdges(characters, relationships), [characters, relationships])

  useEffect(() => {
    if (hasCenteredRef.current || characters.length === 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const avgX = characters.reduce((sum, character) => sum + character.positionX, 0) / characters.length
    const avgY = characters.reduce((sum, character) => sum + character.positionY, 0) / characters.length
    setView({ x: rect.width / 2 - avgX, y: rect.height / 2 - avgY, scale: 1 })
    hasCenteredRef.current = true
  }, [characters])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      setView(previous => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, previous.scale * factor))
        const worldX = (pointer.x - previous.x) / previous.scale
        const worldY = (pointer.y - previous.y) / previous.scale
        return {
          scale: nextScale,
          x: pointer.x - worldX * nextScale,
          y: pointer.y - worldY * nextScale,
        }
      })
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  const handleBackgroundMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragState.current = {
      kind: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewX: view.x,
      startViewY: view.y,
      moved: false,
    }
    setIsPanning(true)

    const handleMove = (moveEvent: MouseEvent) => {
      const state = dragState.current
      if (!state) return
      const dx = moveEvent.clientX - state.startClientX
      const dy = moveEvent.clientY - state.startClientY
      if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD) state.moved = true
      setView(previous => ({ ...previous, x: state.startViewX + dx, y: state.startViewY + dy }))
    }
    const handleUp = (upEvent: MouseEvent) => {
      const state = dragState.current
      dragState.current = null
      setIsPanning(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (state && !state.moved && upEvent.target === containerRef.current) {
        onSelectCharacter(null)
        onSelectRelationship(null)
      }
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [view, onSelectCharacter, onSelectRelationship])

  const handleNodeMouseDown = useCallback((character: MapCharacter, event: React.MouseEvent) => {
    if (event.button !== 0) return
    event.stopPropagation()
    dragState.current = {
      kind: 'node',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewX: view.x,
      startViewY: view.y,
      nodeId: character.id,
      nodeStartX: character.positionX,
      nodeStartY: character.positionY,
      moved: false,
    }

    const handleMove = (moveEvent: MouseEvent) => {
      const state = dragState.current
      if (!state || state.nodeId === undefined) return
      const dx = (moveEvent.clientX - state.startClientX) / view.scale
      const dy = (moveEvent.clientY - state.startClientY) / view.scale
      if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD) state.moved = true
      if (isEditor && state.moved) {
        setDraggingId(state.nodeId)
        setDragOverride({ x: (state.nodeStartX ?? 0) + dx, y: (state.nodeStartY ?? 0) + dy })
      }
    }
    const handleUp = () => {
      const state = dragState.current
      dragState.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setDraggingId(null)
      if (!state || state.nodeId === undefined) return
      if (!state.moved) {
        onSelectCharacter(character.id)
        return
      }
      if (isEditor) {
        setDragOverride(current => {
          if (current) onMoveCharacter(character.id, current.x, current.y)
          return null
        })
      }
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [view, isEditor, onSelectCharacter, onMoveCharacter])

  const positionFor = useCallback((character: MapCharacter): Point => {
    if (draggingId === character.id && dragOverride) return dragOverride
    return { x: character.positionX, y: character.positionY }
  }, [draggingId, dragOverride])

  return (
    <div
      ref={containerRef}
      className={`${styles.canvas} ${isPanning ? styles.panning : ''}`}
      onMouseDown={handleBackgroundMouseDown}
    >
      <svg className={styles.svg}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {edges.map(edge => {
            const from = { ...edge.from, positionX: positionFor(edge.from).x, positionY: positionFor(edge.from).y }
            const to = { ...edge.to, positionX: positionFor(edge.to).x, positionY: positionFor(edge.to).y }
            const geometry = edgeGeometry(from, to, edge.offset)
            const color = edge.relationship.color || '#d9b45c'
            const isSelected = edge.relationship.id === selectedRelationshipId
            const labelPoint = quadraticAt(geometry.start, geometry.control, geometry.end, 0.5)
            const path = `M ${geometry.start.x} ${geometry.start.y} Q ${geometry.control.x} ${geometry.control.y} ${geometry.end.x} ${geometry.end.y}`
            const labelWidth = Math.max(28, edge.relationship.label.length * 7.2 + 16)
            let arrowPoints = ''
            if (edge.relationship.kind === 'directed') {
              const tip = pointAt(geometry.end, geometry.endDir, ARROW_LENGTH)
              const perp = { x: -geometry.endDir.y, y: geometry.endDir.x }
              const left = { x: geometry.end.x + perp.x * 5, y: geometry.end.y + perp.y * 5 }
              const right = { x: geometry.end.x - perp.x * 5, y: geometry.end.y - perp.y * 5 }
              arrowPoints = `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`
            }
            return (
              <g key={edge.relationship.id}>
                <path
                  d={path}
                  className={styles.edgeHit}
                  onClick={() => onSelectRelationship(edge.relationship.id)}
                />
                <path
                  d={path}
                  className={`${styles.edgePath} ${isSelected ? styles.selected : ''}`}
                  stroke={color}
                  strokeDasharray={edge.relationship.kind === 'mutual' ? '2 6' : undefined}
                  onClick={() => onSelectRelationship(edge.relationship.id)}
                />
                {arrowPoints && <polygon points={arrowPoints} fill={color} />}
                <rect
                  x={labelPoint.x - labelWidth / 2}
                  y={labelPoint.y - 11}
                  width={labelWidth}
                  height={22}
                  rx={6}
                  className={styles.edgeLabelBg}
                  onClick={() => onSelectRelationship(edge.relationship.id)}
                  style={{ cursor: 'pointer' }}
                />
                <text x={labelPoint.x} y={labelPoint.y + 1} className={styles.edgeLabel}>
                  {edge.relationship.label}
                </text>
              </g>
            )
          })}

          {characters.map(character => {
            const position = positionFor(character)
            const imageUrl = character.imagePath ? getImageUrl(character.imagePath) : null
            const clipId = `char-clip-${character.id}`
            const isSelected = character.id === selectedCharacterId
            return (
              <g
                key={character.id}
                transform={`translate(${position.x} ${position.y})`}
                className={`${styles.nodeGroup} ${isSelected ? styles.selected : ''}`}
                onMouseDown={event => handleNodeMouseDown(character, event)}
              >
                <defs>
                  <clipPath id={clipId}>
                    <circle r={NODE_RADIUS} />
                  </clipPath>
                </defs>
                <circle r={NODE_RADIUS} className={styles.nodeCircle} />
                {imageUrl && (
                  <image
                    href={imageUrl}
                    x={-NODE_RADIUS}
                    y={-NODE_RADIUS}
                    width={NODE_RADIUS * 2}
                    height={NODE_RADIUS * 2}
                    clipPath={`url(#${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                )}
                {!imageUrl && (
                  <text className={styles.nodeInitial}>
                    {character.name.trim().slice(0, 1).toUpperCase() || '?'}
                  </text>
                )}
                <rect
                  x={-(Math.max(40, character.name.length * 4) + 8) / 2}
                  y={NODE_RADIUS + 6}
                  width={Math.max(40, character.name.length * 4) + 8}
                  height={20}
                  rx={5}
                  className={styles.nodeNameBg}
                />
                <text y={NODE_RADIUS + 20} className={styles.nodeName}>{character.name}</text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
