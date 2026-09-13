import Link from 'next/link'
import { CHRONICLE_CHAPTERS_TABLE } from '@/features/chronicle/constants'
import { formatMoment } from '@/features/chronicle/moment'
import { createChronicleServerClient } from '@/features/chronicle/server/client'
import styles from '@/features/chronicle/routes/AdminPages.module.css'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  title: string
  status: string
  chapter_number: number
  timeline_year: number | null
  timeline_month: number | null
  timeline_day: number | null
  updated_at: string
}

export default async function ChronicleDashboardPage() {
  const client = await createChronicleServerClient()
  const { data } = await client
    .from(CHRONICLE_CHAPTERS_TABLE)
    .select('id, title, status, chapter_number, timeline_year, timeline_month, timeline_day, updated_at')
    .order('updated_at', { ascending: false })
  const chapters = (data as Row[] | null) ?? []
  const published = chapters.filter(chapter => chapter.status === 'published')
  const drafts = chapters.filter(chapter => chapter.status === 'draft')
  const years = published
    .map(chapter => chapter.timeline_year)
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b)

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="ch-kicker">Кабинет автора</p>
          <h1 className={styles.pageTitle}>Хроника</h1>
        </div>
        <Link href="/chronicle/admin/chapters/new" className={styles.primaryLink}>+ Новая глава</Link>
      </header>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{chapters.length}</span>
          <span className={styles.statLabel}>всего глав</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{published.length}</span>
          <span className={styles.statLabel}>опубликовано</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{drafts.length}</span>
          <span className={styles.statLabel}>в черновиках</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {years.length > 0 ? `${years[0]}–${years[years.length - 1]}` : '—'}
          </span>
          <span className={styles.statLabel}>охват времени</span>
        </div>
      </div>

      <p className={styles.sectionTitle}>Недавно правили</p>
      <div className={styles.rows}>
        {chapters.slice(0, 6).map(chapter => (
          <div key={chapter.id} className={styles.row}>
            <span className={styles.rowNumber}>{String(chapter.chapter_number).padStart(2, '0')}</span>
            <div className={styles.rowBody}>
              <Link href={`/chronicle/admin/chapters/${chapter.id}`} className={styles.rowTitle}>
                {chapter.title || 'Без названия'}
              </Link>
              <div className={styles.rowMeta}>
                <span className={chapter.status === 'published' ? styles.dotPublished : styles.dotDraft} />
                <span>{chapter.status === 'published' ? 'опубликована' : 'черновик'}</span>
                <span className={styles.rowYear}>
                  {formatMoment({
                    year: chapter.timeline_year,
                    month: chapter.timeline_month,
                    day: chapter.timeline_day,
                  }) || 'год не задан'}
                </span>
              </div>
            </div>
            <div className={styles.rowActions}>
              <Link href={`/chronicle/admin/chapters/${chapter.id}`} className={styles.action}>Открыть</Link>
            </div>
          </div>
        ))}
        {chapters.length === 0 && <p className={styles.muted}>Ещё ни одной главы. Начните с новой.</p>}
      </div>
    </div>
  )
}
