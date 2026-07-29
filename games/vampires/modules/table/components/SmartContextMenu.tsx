'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

type SmartContextMenuProps = {
  x: number
  y: number
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLDivElement>) => void
}

/** Self-measuring context menu that avoids clipping off screen edges. */
export default function SmartContextMenu({
  x,
  y,
  children,
  onClick,
}: SmartContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = x + width + margin > vw ? Math.max(margin, x - width - margin) : x + margin
    const top = y + height + margin > vh ? Math.max(margin, vh - height - margin) : y
    setPos({ left, top })
  }, [x, y])

  return (
    <div
      ref={ref}
      className="layer-context-menu"
      style={pos
        ? { left: pos.left, top: pos.top }
        : { left: x, top: y, visibility: 'hidden' }
      }
      onClick={onClick}
    >
      {children}
    </div>
  )
}