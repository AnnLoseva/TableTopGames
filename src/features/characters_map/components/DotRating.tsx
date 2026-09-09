'use client'

import styles from './DotRating.module.css'

type Props = {
  value: number
  max: number
  onChange?: (value: number) => void
  size?: 'normal' | 'small'
}

export default function DotRating({ value, max, onChange, size = 'normal' }: Props) {
  const dots = Array.from({ length: max }, (_, index) => index)
  const editable = Boolean(onChange)

  return (
    <span className={`${styles.row} ${size === 'small' ? styles.small : ''}`}>
      {dots.map(index => {
        const filled = index < value
        const handleClick = () => {
          if (!onChange) return
          onChange(index + 1 === value ? index : index + 1)
        }
        return (
          <button
            key={index}
            type="button"
            disabled={!editable}
            onClick={handleClick}
            aria-label={`${index + 1}`}
            className={`${styles.dot} ${filled ? styles.filled : ''} ${editable ? styles.editable : ''}`}
          />
        )
      })}
    </span>
  )
}
