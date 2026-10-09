'use client'

import { useEffect, useRef } from 'react'
import { base64ToFrame, drawPackedFrame } from '../lib/converter'
import type { OledAsset } from '../types'
import styles from './esp32.module.css'

type Props = {
  asset?: OledAsset | null
  previewBase64?: string | null
  label?: string
}

export default function OledPreview({ asset, previewBase64, label = 'OLED preview' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (asset?.frames.length) {
      let frame = 0
      let timer = 0
      const render = () => {
        if (!ref.current) return
        drawPackedFrame(ref.current, asset.frames[frame].pixels)
        const delay = asset.frames[frame].durationMs
        frame = (frame + 1) % asset.frames.length
        timer = window.setTimeout(render, delay)
      }
      render()
      return () => window.clearTimeout(timer)
    }
    if (previewBase64) {
      try { drawPackedFrame(ref.current, base64ToFrame(previewBase64)) } catch { /* malformed old preview */ }
      return
    }
    drawPackedFrame(ref.current, new Uint8Array(1024))
  }, [asset, previewBase64])

  return (
    <figure className={styles.oledFigure}>
      <div className={styles.oledShell}>
        <canvas ref={ref} className={styles.oledCanvas} aria-label={label} />
      </div>
      <figcaption>{label} · 128×64</figcaption>
    </figure>
  )
}

