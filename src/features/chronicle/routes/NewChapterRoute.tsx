'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createChapter, listChapters } from '../api/chaptersApi'
import { createChronicleClient } from '../supabase'
import styles from './AdminPages.module.css'

export default function NewChapterRoute() {
  const client = useMemo(() => createChronicleClient(), [])
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [number, setNumber] = useState(1)
  const [year, setYear] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  // Suggest the next number in reading order, so a new chapter lands at the end.
  useEffect(() => {
    listChapters(client)
      .then(chapters => {
        const highest = chapters.reduce((max, chapter) => Math.max(max, chapter.number), 0)
        setNumber(highest + 1)
      })
      .catch(() => {})
  }, [client])

  const submit = async () => {
    if (!title.trim()) {
      setError('Введите название главы.')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      const created = await createChapter(client, {
        title: title.trim(),
        number,
        year: year === '' ? null : Number(year),
      })
      router.push(`/chronicle/admin/chapters/${created.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать главу.')
      setIsBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="ch-kicker">Новая глава</p>
          <h1 className={styles.pageTitle}>С чего начнём</h1>
        </div>
      </header>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Название</span>
          <input
            type="text"
            value={title}
            autoFocus
            onChange={event => setTitle(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void submit() }}
          />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Номер</span>
            <input type="number" value={number} onChange={event => setNumber(Number(event.target.value) || 1)} />
          </label>
          <label className={styles.field}>
            <span>Год в истории</span>
            <input
              type="number"
              value={year}
              placeholder="можно позже"
              onChange={event => setYear(event.target.value)}
            />
          </label>
        </div>
        <p className={styles.hint}>
          Порядок глав не обязан совпадать с хронологией: номер — это порядок чтения,
          год — место события на шкале времени. Год нужен только для публикации.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.formActions}>
          <button type="button" className={styles.primaryButton} onClick={submit} disabled={isBusy}>
            {isBusy ? 'Создаю…' : 'Создать и писать'}
          </button>
        </div>
      </div>
    </div>
  )
}
