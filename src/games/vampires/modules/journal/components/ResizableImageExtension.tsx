'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// Resize handle definitions: direction key → CSS position + cursor
const HANDLES: Array<{ dir: string; style: React.CSSProperties }> = [
  { dir: 'nw', style: { top: -5, left: -5, cursor: 'nw-resize' } },
  { dir: 'n',  style: { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
  { dir: 'ne', style: { top: -5, right: -5, cursor: 'ne-resize' } },
  { dir: 'e',  style: { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'e-resize' } },
  { dir: 'se', style: { bottom: -5, right: -5, cursor: 'se-resize' } },
  { dir: 's',  style: { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
  { dir: 'sw', style: { bottom: -5, left: -5, cursor: 'sw-resize' } },
  { dir: 'w',  style: { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'w-resize' } },
]

function ResizableImageView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [naturalW, setNaturalW] = useState(0)
  const [naturalH, setNaturalH] = useState(0)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const apply = () => {
      setNaturalW(img.naturalWidth || 300)
      setNaturalH(img.naturalHeight || 200)
    }
    if (img.complete && img.naturalWidth) apply()
    else img.addEventListener('load', apply, { once: true })
  }, [node.attrs.src])

  const startResize = useCallback(
    (e: React.MouseEvent, dir: string) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY
      const startW = (node.attrs.width as number | null) ?? (naturalW || 300)
      const startH = (node.attrs.height as number | null) ?? (naturalH || 200)
      const aspect = startW / (startH || 1)

      setIsResizing(true)

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        const hasN = dir.includes('n')
        const hasS = dir.includes('s')
        const hasE = dir.includes('e')
        const hasW = dir.includes('w')

        let newW = startW

        if (hasE) newW = Math.max(60, startW + dx)
        if (hasW) newW = Math.max(60, startW - dx)
        // Vertical-only handles adjust width proportionally via aspect ratio
        if ((hasN || hasS) && !(hasE || hasW)) {
          const dy2 = hasS ? dy : -dy
          const newH = Math.max(40, startH + dy2)
          newW = Math.round(newH * aspect)
        }

        updateAttributes({
          width: Math.round(newW),
          height: null,
        })
      }

      const onUp = () => {
        setIsResizing(false)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [node.attrs, naturalW, naturalH, updateAttributes],
  )

  const w = node.attrs.width as number | null
  const h = node.attrs.height as number | null

  return (
    <NodeViewWrapper
      as="span"
      style={{
        display: 'inline-block',
        position: 'relative',
        lineHeight: 0,
        verticalAlign: 'middle',
        userSelect: 'none',
        cursor: isResizing ? 'grabbing' : 'default',
        maxWidth: '100%',
      }}
    >
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) || ''}
        title={(node.attrs.title as string) || undefined}
        draggable={false}
        style={{
          display: 'block',
          width: w ? `${w}px` : 'auto',
          height: 'auto',
          maxWidth: '100%',
          borderRadius: 3,
          outline: selected ? '2px solid #d6aa65' : '2px solid transparent',
          outlineOffset: 2,
          pointerEvents: isResizing ? 'none' : 'auto',
          transition: 'outline-color 80ms ease',
        }}
      />

      {/* Resize handles — only shown when image is selected */}
      {selected &&
        HANDLES.map(({ dir, style }) => (
          <span
            key={dir}
            onMouseDown={e => startResize(e, dir)}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: '#d6aa65',
              border: '2px solid #1a0a0a',
              borderRadius: 2,
              zIndex: 20,
              ...style,
            }}
          />
        ))}
    </NodeViewWrapper>
  )
}

/**
 * Inline resizable image node for Tiptap.
 * Stored as <img> in HTML; width/height saved as inline style on the img tag.
 */
export const ResizableImage = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src:    { default: null },
      alt:    { default: null },
      title:  { default: null },
      width:  { default: null, parseHTML: el => parseInt(el.style.width) || el.getAttribute('width') || null },
      height: { default: null, parseHTML: el => parseInt(el.style.height) || el.getAttribute('height') || null },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, ...rest } = HTMLAttributes as Record<string, unknown>
    const style = [
      width  ? `width:${width}px`  : '',
      height ? `height:${height}px` : '',
    ].filter(Boolean).join(';')
    return ['img', mergeAttributes(rest, style ? { style } : {})]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})
