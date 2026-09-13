import Link from 'next/link'
import { readingMinutes } from '../constants'
import { formatMoment } from '../moment'
import type { ChapterNeighbours } from '../server/reader'
import type { ChronicleSettings, PublicChapter } from '../types'
import ChapterContent from './ChapterContent'
import styles from './ChapterPage.module.css'

type Props = {
  chapter: PublicChapter
  neighbours: ChapterNeighbours
  settings: ChronicleSettings
}

export default function ChapterPage({ chapter, neighbours, settings }: Props) {
  const moment = settings.showYearToReader
    ? formatMoment({ year: chapter.year, month: chapter.month, day: chapter.day })
    : ''

  return (
    <article className={styles.page}>
      <nav className={styles.topNav}>
        <Link href="/chronicle" className={styles.backLink}>{settings.title}</Link>
        <Link href="/chronicle/chapters" className={styles.backLink}>Все главы</Link>
      </nav>

      <header className={styles.header}>
        <p className="ch-kicker">Глава {String(chapter.number).padStart(2, '0')}</p>
        <h1 className={styles.title}>{chapter.title || 'Без названия'}</h1>
        <div className={styles.meta}>
          {moment && <span className={styles.year}>{moment}</span>}
          {chapter.timelineLabel && <span className={styles.label}>{chapter.timelineLabel}</span>}
          <span className={styles.minutes}>{readingMinutes(chapter.contentText)} мин чтения</span>
        </div>
      </header>

      <div className={styles.body}>
        <ChapterContent doc={chapter.content} />
      </div>

      <footer className={styles.footer}>
        {neighbours.previous ? (
          <Link className={styles.navLink} href={`/chronicle/chapter/${neighbours.previous.slug}`}>
            <span className="ch-kicker">Предыдущая</span>
            <span className={styles.navTitle}>{neighbours.previous.title}</span>
          </Link>
        ) : <span />}
        {neighbours.next ? (
          <Link className={`${styles.navLink} ${styles.navNext}`} href={`/chronicle/chapter/${neighbours.next.slug}`}>
            <span className="ch-kicker">Следующая</span>
            <span className={styles.navTitle}>{neighbours.next.title}</span>
          </Link>
        ) : <span />}
      </footer>
    </article>
  )
}
