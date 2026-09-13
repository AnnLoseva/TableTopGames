'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { deleteChapter, listChapters, updateChapter } from '../api/chaptersApi'
import { countWords } from '../constants'
import { formatMoment } from '../moment'
import { createChronicleClient } from '../supabase'
import type { Chapter } from '../types'
import styles from './AdminPages.module.css'

type Filter = 'all' | 'draft' | 'published'

export default function AdminChaptersRoute() {
  const client = useMemo(() => createChronicleClient(), [])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      setChapters(await listChapters(client))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить главы.')
    } finally {
      setIsLoading(false)
    }
  }, [client])

  useEffect(() => { void reload() }, [reload])

  const togglePublished = async (chapter: Chapter) => {
    if (chapter.status === 'draft' && chapter.moment.year === null) {
      setError(`«${chapter.title || 'Без названия'}»: чтобы опубликовать, укажите год на шкале времени.`)
      return
    }
    try {
      const updated = await updateChapter(client, chapter.id, {
        status: chapter.status === 'published' ? 'draft' : 'published',
      })
      setChapters(previous => previous.map(item => (item.id === chapter.id ? updated : item)))
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось изменить статус.')
    }
  }

  const remove = async (chapter: Chapter) => {
    if (!window.confirm(`Удалить главу «${chapter.title || 'без названия'}»? Это необратимо.`)) return
    await deleteChapter(client, chapter.id)
    setChapters(previous => previous.filter(item => item.id !== chapter.id))
  }

  const visible = chapters.filter(chapter => filter === 'all' || chapter.status === filter)
  const counts = {
    all: chapters.length,
    draft: chapters.filter(chapter => chapter.status === 'draft').length,
    published: chapters.filter(chapter => chapter.status === 'published').length,
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="ch-kicker">Главы</p>
          <h1 className={styles.pageTitle}>Рукопись</h1>
        </div>
        <Link href="/chronicle/admin/chapters/new" className={styles.primaryLink}>+ Новая глава</Link>
      </header>

      <div className={styles.filters}>
        {([
          ['all', 'Все'],
          ['draft', 'Черновики'],
          ['published', 'Опубликованные'],
        ] as [Filter, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`${styles.filter} ${filter === value ? styles.filterActive : ''}`}
            onClick={() => setFilter(value)}
          >
            {label} <span className={styles.filterCount}>{counts[value]}</span>
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {isLoading && <p className={styles.muted}>Загружаю…</p>}
      {!isLoading && visible.length === 0 && (
        <p className={styles.muted}>Здесь пока пусто. Начните с новой главы.</p>
      )}

      <div className={styles.rows}>
        {visible.map(chapter => (
          <div key={chapter.id} className={styles.row}>
            <span className={styles.rowNumber}>{String(chapter.number).padStart(2, '0')}</span>
            <div className={styles.rowBody}>
              <Link href={`/chronicle/admin/chapters/${chapter.id}`} className={styles.rowTitle}>
                {chapter.title || 'Без названия'}
              </Link>
              <div className={styles.rowMeta}>
                <span className={chapter.status === 'published' ? styles.dotPublished : styles.dotDraft} />
                <span>{chapter.status === 'published' ? 'опубликована' : 'черновик'}</span>
                <span className={styles.rowYear}>{formatMoment(chapter.moment) || 'год не задан'}</span>
                {chapter.moment.label && <span className={styles.rowLabel}>{chapter.moment.label}</span>}
                <span>{countWords(chapter.contentText)} слов</span>
              </div>
            </div>
            <div className={styles.rowActions}>
              <Link href={`/chronicle/admin/chapters/${chapter.id}`} className={styles.action}>Открыть</Link>
              <button type="button" className={styles.action} onClick={() => togglePublished(chapter)}>
                {chapter.status === 'published' ? 'Снять' : 'Опубликовать'}
              </button>
              <button type="button" className={styles.actionDanger} onClick={() => remove(chapter)}>Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
