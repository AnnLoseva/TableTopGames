'use client'

import type { DamageTrack } from '../types'
import styles from './TrackBoxes.module.css'

const MAX_TRACK_LENGTH = 20

type Props = {
  track: DamageTrack
  onChange?: (track: DamageTrack) => void
}

export default function TrackBoxes({ track, onChange }: Props) {
  const editable = Boolean(onChange)
  const boxes = Array.from({ length: track.max }, (_, index) => track.boxes[index] ?? 0)

  const handleBoxClick = (index: number) => {
    if (!onChange) return
    const nextBoxes = [...boxes]
    nextBoxes[index] = ((nextBoxes[index] ?? 0) + 1) % 3
    onChange({ ...track, boxes: nextBoxes })
  }

  const handleMaxChange = (nextMax: number) => {
    if (!onChange) return
    const clamped = Math.max(1, Math.min(MAX_TRACK_LENGTH, Math.round(nextMax) || 1))
    onChange({ ...track, max: clamped })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.boxes}>
        {boxes.map((state, index) => (
          <button
            key={index}
            type="button"
            disabled={!editable}
            onClick={() => handleBoxClick(index)}
            className={`${styles.box} ${editable ? styles.editable : ''} ${state === 1 ? styles.superficial : ''} ${state === 2 ? styles.aggravated : ''}`}
          >
            {state === 1 ? '/' : state === 2 ? '✕' : ''}
          </button>
        ))}
      </div>
      {editable && (
        <label className={styles.maxField}>
          Максимум
          <input
            type="number"
            min={1}
            max={MAX_TRACK_LENGTH}
            value={track.max}
            onChange={event => handleMaxChange(Number(event.target.value))}
          />
        </label>
      )}
    </div>
  )
}
