'use client'

import { useMemo } from 'react'
import { t, type MapLanguage } from '../i18n'
import {
  eventOrdinal,
  formatEventDate,
  formatShortDate,
  momentForDate,
  momentOrdinal,
  yearMoment,
  type TimelineBounds,
  type TimelineMark,
  type TimelineMoment,
} from '../timeline'
import type { ChapterMark } from '../types'
import styles from './TimelineControl.module.css'

type Props = {
  bounds: TimelineBounds
  value: TimelineMoment
  marks: TimelineMark[]
  /** Chapters of the chronicle placed on this timeline — author-only, empty for everyone else. */
  chapterMarks?: ChapterMark[]
  language: MapLanguage
  onChange: (moment: TimelineMoment) => void
}

export default function TimelineControl({ bounds, value, marks, chapterMarks = [], language, onChange }: Props) {
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

  // Where each chapter sits on the same scale as the map's own events, plus
  // whichever chapters the cursor is standing on right now.
  const chapterPositions = useMemo(() => chapterMarks.map(chapter => ({
    ...chapter,
    ordinal: eventOrdinal(chapter),
    percent: ((chapter.year + (chapter.month === null ? 0 : (chapter.month - 1) / 12) - min) / (max - min)) * 100,
  })), [chapterMarks, min, max])

  const chaptersHere = chapterPositions.filter(chapter => chapter.ordinal === cursor)
  const hasPrevious = marks.some(mark => mark.ordinal < cursor)
  const hasNext = marks.some(mark => mark.ordinal > cursor)

  const stepTo = (direction: -1 | 1) => {
    const next = direction === -1
      ? [...marks].reverse().find(mark => mark.ordinal < cursor)
      : marks.find(mark => mark.ordinal > cursor)
    if (next) onChange(next.moment)
  }

  return (
    <div className={styles.barWrap}>
      {chaptersHere.length > 0 && (
        <div className={styles.chapterChips}>
          {chaptersHere.map(chapter => (
            <a key={chapter.id} className={styles.chapterChip} href={`/chronicle/admin/chapters/${chapter.id}`}>
              <span className={styles.chapterChipNumber}>{String(chapter.number).padStart(2, '0')}</span>
              {chapter.title || '—'}
              <span className={styles.chapterChipOpen}>{s.openChapter}</span>
            </a>
          ))}
        </div>
      )}
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
        {chapterPositions.length > 0 && (
          <div className={styles.chapterMarks}>
            {chapterPositions.map(chapter => (
              <button
                key={chapter.id}
                type="button"
                className={`${styles.chapterMark} ${chapter.ordinal === cursor ? styles.chapterMarkActive : ''}`}
                style={{ left: `${chapter.percent}%` }}
                title={s.chapterMarkTitle(chapter.number, chapter.title || '—', formatEventDate(chapter, language))}
                onClick={() => onChange(momentForDate(chapter))}
              >
                {chapter.number}
              </button>
            ))}
          </div>
        )}
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
    </div>
  )
}
