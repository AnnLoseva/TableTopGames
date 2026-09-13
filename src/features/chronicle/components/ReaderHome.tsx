import Link from 'next/link'
import { readingMinutes } from '../constants'
import { formatMoment } from '../moment'
import type { ChronicleSettings, PublicChapter } from '../types'
import styles from './ReaderHome.module.css'

type Props = {
  settings: ChronicleSettings
  chapters: PublicChapter[]
}

export default function ReaderHome({ settings, chapters }: Props) {
  const first = chapters[0]
  const latest = chapters[chapters.length - 1]

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className="ch-kicker">Хроника</p>
        <h1 className={styles.title}>{settings.title}</h1>
        {settings.subtitle && <p className={styles.subtitle}>{settings.subtitle}</p>}
        {settings.intro && <p className={styles.intro}>{settings.intro}</p>}
        {first && (
          <div className={styles.actions}>
            <Link className={styles.readButton} href={`/chronicle/chapter/${first.slug}`}>
              Читать
            </Link>
            {latest && latest.slug !== first.slug && (
              <Link className={styles.textLink} href={`/chronicle/chapter/${latest.slug}`}>
                Последняя глава — {latest.title}
              </Link>
            )}
          </div>
        )}
      </header>

      <section className={styles.list}>
        <div className={styles.listHead}>
          <p className="ch-kicker">Главы</p>
          <span className={styles.count}>{chapters.length}</span>
        </div>

        {chapters.length === 0 && (
          <p className={styles.empty}>Пока не опубликовано ни одной главы.</p>
        )}

        {chapters.map(chapter => {
          const moment = settings.showYearToReader ? formatMoment({
            year: chapter.year, month: chapter.month, day: chapter.day,
          }) : ''
          return (
            <Link key={chapter.id} className={styles.row} href={`/chronicle/chapter/${chapter.slug}`}>
              <span className={styles.rowNumber}>{String(chapter.number).padStart(2, '0')}</span>
              <span className={styles.rowBody}>
                <span className={styles.rowTitle}>{chapter.title || 'Без названия'}</span>
                {chapter.timelineLabel && <span className={styles.rowLabel}>{chapter.timelineLabel}</span>}
              </span>
              <span className={styles.rowMeta}>
                {moment && <span className={styles.rowYear}>{moment}</span>}
                <span className={styles.rowMinutes}>{readingMinutes(chapter.contentText)} мин</span>
              </span>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
