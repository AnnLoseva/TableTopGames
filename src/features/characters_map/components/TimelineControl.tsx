'use client'

import { useMemo } from 'react'
import { t, type MapLanguage } from '../i18n'
import {
  formatShortDate,
  momentOrdinal,
  yearMoment,
  type TimelineBounds,
  type TimelineMark,
  type TimelineMoment,
} from '../timeline'
import styles from './TimelineControl.module.css'

type Props = {
  bounds: TimelineBounds
  value: TimelineMoment
  marks: TimelineMark[]
  language: MapLanguage
  onChange: (moment: TimelineMoment) => void
}

export default function TimelineControl({ bounds, value, marks, language, onChange }: Props) {
  const s = t(language).timelineControl
  const min = Math.min(bounds.min, value.year) - 1
  const max = Math.max(bounds.max, value.year) + 1
  const isAtPresent = value.year >= bounds.max
  // The slider parks the cursor at the end of a year, so anything else means
  // the owner (or the stepper) picked a specific day inside it.
  const isWholeYear = value.month === 12 && value.day === 31

  const markPositions = useMemo(() => marks.map(mark => {
    // Place a dated mark inside its year rather than on the year tick.
    const fraction = mark.moment.month === 12 && mark.moment.day === 31 ? 1 : (mark.moment.month - 1) / 12
    return { ...mark, percent: ((mark.year + fraction - min) / (max - min)) * 100 }
  }), [marks, min, max])

  const cursor = momentOrdinal(value)
  const hasPrevious = marks.some(mark => mark.ordinal < cursor)
  const hasNext = marks.some(mark => mark.ordinal > cursor)

  const stepTo = (direction: -1 | 1) => {
    const next = direction === -1
      ? [...marks].reverse().find(mark => mark.ordinal < cursor)
      : marks.find(mark => mark.ordinal > cursor)
    if (next) onChange(next.moment)
  }

  return (
    <div className={styles.bar}>
      <button type="button" className={styles.stepButton} onClick={() => stepTo(-1)} disabled={!hasPrevious} title={s.prevEventTitle}>
        ‹
      </button>
      <div className={styles.trackWrap}>
        <input
          type="range"
          className={styles.track}
          min={min}
          max={max}
          value={value.year}
          onChange={event => onChange(yearMoment(Number(event.target.value)))}
        />
        <div className={styles.marks}>
          {markPositions.map(mark => (
            <span key={mark.ordinal} className={styles.mark} style={{ left: `${mark.percent}%` }} title={mark.label} />
          ))}
        </div>
      </div>
      <button type="button" className={styles.stepButton} onClick={() => stepTo(1)} disabled={!hasNext} title={s.nextEventTitle}>
        ›
      </button>
      <label className={styles.yearField}>
        {s.yearLabel}
        <input
          type="number"
          className={styles.yearInput}
          value={value.year}
          onChange={event => {
            const parsed = Number(event.target.value)
            if (!Number.isNaN(parsed)) onChange(yearMoment(parsed))
          }}
        />
      </label>
      {!isWholeYear && (
        <button
          type="button"
          className={styles.dateChip}
          onClick={() => onChange(yearMoment(value.year))}
          title={s.clearDateTitle}
        >
          {formatShortDate(value, language)} ×
        </button>
      )}
      <button
        type="button"
        className={`${styles.presentButton} ${isAtPresent && isWholeYear ? styles.atPresent : ''}`}
        onClick={() => onChange(yearMoment(bounds.max))}
      >
        {s.presentButton}
      </button>
    </div>
  )
}
