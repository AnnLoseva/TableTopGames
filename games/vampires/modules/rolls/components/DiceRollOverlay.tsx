'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Die } from '@/games/vampires/modules/table/types'

export type DiceOverlayDie = {
  value: number
  kind: Die['kind']
}

export type DiceOverlayGroup = {
  key: string
  label: string
  dice: DiceOverlayDie[]
}

export type DiceOverlayRoll = {
  id: string
  title: string
  groups: DiceOverlayGroup[]
  summary?: string
  summaryTone?: 'good' | 'bad' | 'neutral'
}

// A D10 is a pentagonal trapezohedron: 10 kite-shaped faces, 6 vertices (2 triangles) each.
// Which physical face shows which pip value is an arbitrary but fixed convention so that
// opposite faces don't repeat values; this mirrors the convention used by the reference model.
const FACE_NUMBERS = [1, 6, 2, 7, 3, 8, 4, 9, 5, 10]

type DieGeometryKind = 'normal' | 'hungry'

// These are the actual kite-shaped face art (transparent outside the kite) extracted from the
// reference 3D dice bundle, not the project's existing /vampires/static/dice/*.png — those are hexagonal
// icon badges built for the flat 2D roll list and don't line up with this geometry's UVs (the
// kite's apex/base poke past the hexagon's edges into its background, showing up as white tips).
const DICE_TEXTURES: Record<DieGeometryKind, string[]> = {
  normal: ['/vampires/static/dice3d/normal-fail.png', '/vampires/static/dice3d/normal-success.png', '/vampires/static/dice3d/normal-critical.png'],
  hungry: [
    '/vampires/static/dice3d/hunger-critical-fail.png',
    '/vampires/static/dice3d/hunger-fail.png',
    '/vampires/static/dice3d/hunger-success.png',
    '/vampires/static/dice3d/hunger-critical.png',
  ],
}

function materialGroupForFace(num: number, kind: DieGeometryKind) {
  if (kind === 'hungry') {
    if (num === 1) return 0
    if (num <= 5) return 1
    if (num <= 9) return 2
    return 3
  }
  return num <= 5 ? 0 : num <= 9 ? 1 : 2
}

type FaceBasis = { normal: THREE.Vector3; up: THREE.Vector3 }

type DiceAssets = {
  geometries: Record<DieGeometryKind, THREE.BufferGeometry>
  materials: Record<DieGeometryKind, THREE.MeshBasicMaterial[]>
  faces: FaceBasis[]
}

let cachedAssets: DiceAssets | null = null

// Geometry, materials and textures are expensive to build/decode but never change between
// rolls, so they're built once and shared by every DiceCanvas for the lifetime of the page.
function getDiceAssets(): DiceAssets {
  if (cachedAssets) return cachedAssets

  const r = 1
  const c = 1.35
  const cos36 = Math.cos((Math.PI * 36) / 180)
  const d = (c * (1 - cos36)) / (1 + cos36)
  const upper: THREE.Vector3[] = []
  const lower: THREE.Vector3[] = []
  for (let k = 0; k < 5; k++) {
    const au = (2 * Math.PI * k) / 5
    const al = au + Math.PI / 5
    upper.push(new THREE.Vector3(r * Math.cos(au), d, r * Math.sin(au)))
    lower.push(new THREE.Vector3(r * Math.cos(al), -d, r * Math.sin(al)))
  }
  const top = new THREE.Vector3(0, c, 0)
  const bottom = new THREE.Vector3(0, -c, 0)
  const uvApex = [0.5, 0.995]
  const uvFar = [0.5, 0.04]
  const uvLeft = [0.03, 0.225]
  const uvRight = [0.97, 0.225]

  const positions: number[] = []
  const uvs: number[] = []
  const normals: number[] = []
  const faces: FaceBasis[] = []

  const addFace = (apex: THREE.Vector3, wa: THREE.Vector3, far: THREE.Vector3, wb: THREE.Vector3) => {
    let p1 = wa
    let p3 = wb
    const normal = new THREE.Vector3().subVectors(p1, apex).cross(new THREE.Vector3().subVectors(p3, apex)).normalize()
    const center = new THREE.Vector3().add(apex).add(p1).add(far).add(p3).multiplyScalar(0.25)
    if (normal.dot(center) < 0) {
      const swap = p1
      p1 = p3
      p3 = swap
      normal.negate()
    }
    const up = new THREE.Vector3().subVectors(apex, far)
    up.sub(normal.clone().multiplyScalar(up.dot(normal))).normalize()
    faces.push({ normal: normal.clone(), up })
    const push = (v: THREE.Vector3, uv: number[]) => {
      positions.push(v.x, v.y, v.z)
      uvs.push(uv[0], uv[1])
      normals.push(normal.x, normal.y, normal.z)
    }
    push(apex, uvApex); push(p1, uvLeft); push(far, uvFar)
    push(apex, uvApex); push(far, uvFar); push(p3, uvRight)
  }

  for (let k = 0; k < 5; k++) addFace(top, upper[k], lower[k], upper[(k + 1) % 5])
  for (let k = 0; k < 5; k++) addFace(bottom, lower[k], upper[(k + 1) % 5], lower[(k + 1) % 5])

  const base = new THREE.BufferGeometry()
  base.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  base.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  base.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))

  const loader = new THREE.TextureLoader()
  const geometries = {} as Record<DieGeometryKind, THREE.BufferGeometry>
  const materials = {} as Record<DieGeometryKind, THREE.MeshBasicMaterial[]>

  // Lit materials (MeshStandardMaterial) put the rolled face almost square-on to both the
  // camera and the key light at once, so several light contributions stacked on the same
  // face and clipped to white instead of showing the artwork. The face art already has its
  // baked-in border/shading, so render it unlit and let it show through exactly as authored.
  ;(['normal', 'hungry'] as DieGeometryKind[]).forEach(kind => {
    const geometry = base.clone()
    for (let f = 0; f < 10; f++) geometry.addGroup(f * 6, 6, materialGroupForFace(FACE_NUMBERS[f], kind))
    geometries[kind] = geometry
    materials[kind] = DICE_TEXTURES[kind].map(src => {
      const texture = loader.load(src)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      texture.minFilter = THREE.LinearMipmapLinearFilter
      return new THREE.MeshBasicMaterial({ map: texture })
    })
  })

  cachedAssets = { geometries, materials, faces }
  return cachedAssets
}

function computeFaceQuaternion(normal: THREE.Vector3, up: THREE.Vector3) {
  const targetZ = new THREE.Vector3(0.16, 0.2, 1).normalize()
  const targetY = new THREE.Vector3(0, 1, 0)
  targetY.sub(targetZ.clone().multiplyScalar(targetY.dot(targetZ))).normalize()
  const targetX = new THREE.Vector3().crossVectors(targetY, targetZ).normalize()
  const targetBasis = new THREE.Matrix4().makeBasis(targetX, targetY, targetZ)

  const faceZ = normal.clone().normalize()
  const faceY = up.clone()
  faceY.sub(faceZ.clone().multiplyScalar(faceY.dot(faceZ))).normalize()
  const faceX = new THREE.Vector3().crossVectors(faceY, faceZ).normalize()
  const faceBasis = new THREE.Matrix4().makeBasis(faceX, faceY, faceZ)

  return new THREE.Quaternion().setFromRotationMatrix(targetBasis.multiply(faceBasis.transpose()))
}

function computeCellSize(groups: DiceOverlayGroup[]) {
  const maxCount = Math.max(1, ...groups.map(group => group.dice.length))
  const cols = Math.ceil(Math.sqrt(maxCount))
  const rows = Math.ceil(maxCount / cols)
  const viewportWidth = typeof window === 'undefined' ? 900 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 700 : window.innerHeight
  const groupCols = groups.length > 1 ? 2 : 1
  const availableWidth = Math.min(620, viewportWidth * 0.85) / groupCols
  const availableHeight = Math.min(440, viewportHeight * 0.5)
  const bySize = Math.min(availableWidth / cols, availableHeight / rows)
  return Math.max(46, Math.min(132, Math.floor(bySize)))
}

function DiceCanvas({ dice, cellSize, onSettled }: { dice: DiceOverlayDie[]; cellSize: number; onSettled: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dice.length === 0) {
      onSettled()
      return
    }

    let disposed = false
    let renderer: THREE.WebGLRenderer | null = null
    let raf = 0
    let settled = false
    const finishSettle = () => {
      if (settled) return
      settled = true
      onSettled()
    }

    try {
      const assets = getDiceAssets()
      const scene = new THREE.Scene()
      const cols = Math.ceil(Math.sqrt(dice.length))
      const rows = Math.ceil(dice.length / cols)
      const cellWorld = 3.1

      const camera = new THREE.OrthographicCamera(
        (-cols * cellWorld) / 2, (cols * cellWorld) / 2,
        (rows * cellWorld) / 2, (-rows * cellWorld) / 2,
        0.1, 100,
      )
      camera.position.set(0, 0, 12)

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
      renderer.outputColorSpace = THREE.SRGBColorSpace

      const widthPx = cols * cellSize
      const heightPx = rows * cellSize
      renderer.setSize(widthPx, heightPx, false)
      canvas.style.width = `${widthPx}px`
      canvas.style.height = `${heightPx}px`

      const stagger = dice.length <= 1 ? 0 : Math.min(0.45, 1.3 / (dice.length - 1))

      const instances = dice.map((die, index) => {
        const kind: DieGeometryKind = die.kind.startsWith('hunger') ? 'hungry' : 'normal'
        const mesh = new THREE.Mesh(assets.geometries[kind], assets.materials[kind])
        mesh.scale.setScalar(0.92)
        const col = index % cols
        const row = Math.floor(index / cols)
        mesh.position.set((col - (cols - 1) / 2) * cellWorld, -(row - (rows - 1) / 2) * cellWorld, 0)

        const startFace = (index * 3) % 10
        mesh.quaternion.copy(computeFaceQuaternion(assets.faces[startFace].normal, assets.faces[startFace].up))
        scene.add(mesh)

        const targetFace = Math.max(0, FACE_NUMBERS.indexOf(die.value))
        const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        const omega = 9 + Math.random() * 4
        const spinDuration = 0.6 + index * stagger
        const settleDuration = 0.6
        const startQuat = mesh.quaternion.clone()
        const quatAtSpinEnd = startQuat.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(axis, omega * spinDuration))
        const endQuat = computeFaceQuaternion(assets.faces[targetFace].normal, assets.faces[targetFace].up)

        return { mesh, startQuat, axis, omega, spinDuration, settleDuration, quatAtSpinEnd, endQuat }
      })

      const maxDuration = Math.max(...instances.map(item => item.spinDuration + item.settleDuration))
      const startTime = performance.now()

      const tick = () => {
        if (disposed) return
        const t = (performance.now() - startTime) / 1000
        for (const item of instances) {
          let quat: THREE.Quaternion
          if (t < item.spinDuration) {
            quat = item.startQuat.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(item.axis, item.omega * t))
          } else {
            const s = Math.min(1, (t - item.spinDuration) / item.settleDuration)
            const eased = 1 - Math.pow(1 - s, 3)
            quat = item.quatAtSpinEnd.clone().slerp(item.endQuat, eased)
          }
          item.mesh.quaternion.copy(quat)
        }
        renderer?.render(scene, camera)
        if (t >= maxDuration) {
          finishSettle()
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)

      return () => {
        disposed = true
        cancelAnimationFrame(raf)
        instances.forEach(item => scene.remove(item.mesh))
        renderer?.dispose()
      }
    } catch (err) {
      console.error('[DiceRollOverlay] Не удалось запустить 3D-сцену кубиков:', err)
      finishSettle()
      return undefined
    }
    // dice/cellSize identity is stable per roll (parent never mutates an in-flight roll),
    // and onSettled is a stable ref-backed callback — see DiceRollOverlay below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dice, cellSize])

  return <canvas ref={canvasRef} className="dice-overlay-canvas" />
}

export default function DiceRollOverlay({ roll, onDone }: { roll: DiceOverlayRoll; onDone: () => void }) {
  const [settledCount, setSettledCount] = useState(0)
  const [closing, setClosing] = useState(false)
  const doneRef = useRef(false)
  const closeRequestedRef = useRef(false)
  // Stable identity shared by every DiceCanvas: if this changed when one group settled,
  // the others would see a new `onSettled` prop, re-run their mount effect, and restart mid-spin.
  const handleSettledRef = useRef(() => setSettledCount(n => n + 1))

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  const requestClose = (delay: number) => {
    if (closeRequestedRef.current) return
    closeRequestedRef.current = true
    window.setTimeout(() => {
      setClosing(true)
      window.setTimeout(finish, 260)
    }, delay)
  }

  useEffect(() => {
    if (settledCount >= roll.groups.length) requestClose(950)
  }, [settledCount, roll.groups.length])

  useEffect(() => {
    const safety = window.setTimeout(() => requestClose(0), 9000)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose(0)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(safety)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const cellSize = useMemo(() => computeCellSize(roll.groups), [roll.id])
  const allSettled = settledCount >= roll.groups.length

  return (
    <div
      className={`dice-overlay-backdrop ${closing ? 'closing' : ''}`}
      onClick={() => requestClose(0)}
      role="dialog"
      aria-modal="true"
      aria-label={roll.title}
    >
      <div className="dice-overlay-panel" onClick={event => event.stopPropagation()}>
        <div className="dice-overlay-title">{roll.title}</div>
        <div className={`dice-overlay-groups ${roll.groups.length > 1 ? 'two' : 'one'}`}>
          {roll.groups.map(group => (
            <div className="dice-overlay-group" key={group.key}>
              {group.label ? <div className="dice-overlay-group-label">{group.label}</div> : null}
              <DiceCanvas dice={group.dice} cellSize={cellSize} onSettled={handleSettledRef.current} />
            </div>
          ))}
        </div>
        {roll.summary ? (
          <div className={`dice-overlay-summary ${allSettled ? 'visible' : ''} tone-${roll.summaryTone || 'neutral'}`}>
            {roll.summary}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .dice-overlay-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 38%, rgba(44, 38, 34, 0.92) 0%, rgba(25, 21, 15, 0.96) 55%, rgba(8, 6, 4, 0.98) 100%);
          backdrop-filter: blur(3px);
          opacity: 1;
          transition: opacity 0.26s ease;
          cursor: pointer;
        }

        .dice-overlay-backdrop.closing {
          opacity: 0;
        }

        .dice-overlay-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 32px 40px;
          cursor: default;
          animation: dice-overlay-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        @keyframes dice-overlay-in {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .dice-overlay-title {
          color: #e7c9a9;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: center;
        }

        .dice-overlay-groups {
          display: flex;
          align-items: flex-start;
          gap: 36px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .dice-overlay-groups.two {
          padding: 0 8px;
        }

        .dice-overlay-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .dice-overlay-group-label {
          color: #c9a98a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .dice-overlay-canvas {
          display: block;
        }

        .dice-overlay-summary {
          color: #9a6b6b;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-align: center;
          min-height: 22px;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .dice-overlay-summary.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .dice-overlay-summary.tone-good {
          color: #36d675;
        }

        .dice-overlay-summary.tone-bad {
          color: #e23b3b;
        }
      `}</style>
    </div>
  )
}
