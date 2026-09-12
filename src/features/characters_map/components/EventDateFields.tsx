'use client'

import { monthOptions, t, type MapLanguage } from '../i18n'
import type { DatedLike } from '../timeline'
import styles from './CharacterSheetView.module.css'

type Props = {
  value: DatedLike
  language: MapLanguage
  onChange: (patch: Partial<DatedLike>) => void
}

/**
 * Year + optional month + optional day, shared by the character and the
 * relationship event editors. The year is the only required part; month and
 * day are a refinement for years that hold a lot of events. Clearing the
 * month clears the day too — a day without a month can't be ordered.
 */
export default function EventDateFields({ value, language, onChange }: Props) {
  const s = t(language).dates
  return (
    <>
      <input
        type="number"
        className={styles.timelineYearInput}
        value={value.year}
        onChange={event => onChange({ year: Number(event.target.value) })}
      />
      <select
        className={styles.timelineMonthSelect}
        aria-label={s.ariaMonth}
        value={value.month ?? ''}
        onChange={event => {
          const month = event.target.value === '' ? null : Number(event.target.value)
          onChange(month === null ? { month: null, day: null } : { month })
        }}
      >
        <option value="">{s.monthNone}</option>
        {monthOptions(language).map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <input
        type="number"
        className={styles.timelineDayInput}
        aria-label={s.ariaDay}
        min={1}
        max={31}
        placeholder={s.dayPlaceholder}
        disabled={value.month === null}
        value={value.day ?? ''}
        onChange={event => {
          if (event.target.value === '') {
            onChange({ day: null })
            return
          }
          const day = Number(event.target.value)
          onChange({ day: day >= 1 && day <= 31 ? day : null })
        }}
      />
    </>
  )
}
