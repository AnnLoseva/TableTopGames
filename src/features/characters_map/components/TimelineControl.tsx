'use client'

import { useMemo } from 'react'
import { t, type MapLanguage } from '../i18n'
import type { TimelineBounds, TimelineMark } from '../timeline'
import styles from './TimelineControl.module.css'

type Props = {
  bounds: TimelineBounds
  value: number
  marks: TimelineMark[]
  language: MapLanguage
  onChange: (year: number) => void
}

export default function TimelineControl({ bounds, value, marks, language, onChange }: Props) {
  const s = t(language).timelineControl
  const min = Math.min(bounds.min, value) - 1
  const max = Math.max(bounds.max, value) + 1
  const isAtPresent = value >= bounds.max

  const markPositions = useMemo(() => marks.map(mark => ({
    ...mark,
    percent: ((mark.year - min) / (max - min)) * 100,
  })), [marks, min, max])

  const years = useMemo(() => Array.from(new Set(marks.map(mark => mark.year))).sort((a, b) => a - b), [marks])

  const stepTo = (direction: -1 | 1) => {
    const next = direction === -1
      ? [...years].reverse().find(year => year < value)
      : years.find(year => year > value)
    if (next !== undefined) onChange(next)
  }

  return (
    <div className={styles.bar}>
      <button type="button" className={styles.stepButton} onClick={() => stepTo(-1)} disabled={!years.some(year => year < value)} title={s.prevEventTitle}>
        ‹
      </button>
      <div className={styles.trackWrap}>
        <input
          type="range"
          className={styles.track}
          min={min}
          max={max}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
        <div className={styles.marks}>
          {markPositions.map((mark, index) => (
            <span key={index} className={styles.mark} style={{ left: `${mark.percent}%` }} title={mark.label} />
          ))}
        </div>
      </div>
      <button type="button" className={styles.stepButton} onClick={() => stepTo(1)} disabled={!years.some(year => year > value)} title={s.nextEventTitle}>
        ›
      </button>
      <label className={styles.yearField}>
        {s.yearLabel}
        <input
          type="number"
          className={styles.yearInput}
          value={value}
          onChange={event => {
            const parsed = Number(event.target.value)
            if (!Number.isNaN(parsed)) onChange(parsed)
          }}
        />
      </label>
      <button
        type="button"
        className={`${styles.presentButton} ${isAtPresent ? styles.atPresent : ''}`}
        onClick={() => onChange(bounds.max)}
      >
        {s.presentButton}
      </button>
    </div>
  )
}
