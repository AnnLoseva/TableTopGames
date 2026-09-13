'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { monthOptions } from '@/features/characters_map/i18n'
import { deleteChapter, getChapter, updateChapter } from '../api/chaptersApi'
import { listSnapshots } from '../api/snapshotsApi'
import {
  CHAPTER_TITLE_MAX_LENGTH,
  TIMELINE_LABEL_MAX_LENGTH,
  countWords,
  slugify,
} from '../constants'
import { formatMoment, momentQuery } from '../moment'
import { createChronicleClient } from '../supabase'
import type { Chapter, ChapterDoc, ChapterMoment, Snapshot } from '../types'
import ChapterContent from '../components/ChapterContent'
import ChapterEditor from '../components/ChapterEditor'
import styles from './ChapterEditorRoute.module.css'

const AUTOSAVE_DELAY_MS = 1500

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export default function ChapterEditorRoute({ chapterId }: { chapterId: string }) {
  const client = useMemo(() => createChronicleClient(), [])
  const router = useRouter()

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const [isPreview, setIsPreview] = useState(false)

  // Editable state, seeded from the loaded chapter.
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [number, setNumber] = useState(1)
  const [moment, setMoment] = useState<ChapterMoment>({ year: null, month: null, day: null, label: '', snapshotId: null })
  const [authorNotes, setAuthorNotes] = useState('')
  const [doc, setDoc] = useState<ChapterDoc>({ type: 'doc', content: [] })
  const [text, setText] = useState('')

  // Autosave plumbing: the timer reads the latest values through a ref, so a
  // keystroke never restarts the save with a stale snapshot of the form.
  const latestRef = useRef({ title, slug, number, moment, authorNotes, doc, text })
  latestRef.current = { title, slug, number, moment, authorNotes, doc, text }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getChapter(client, chapterId), listSnapshots(client)])
      .then(([loaded, loadedSnapshots]) => {
        if (cancelled) return
        if (!loaded) {
          setLoadError('Глава не найдена.')
          return
        }
        setChapter(loaded)
        setSnapshots(loadedSnapshots)
        setTitle(loaded.title)
        setSlug(loaded.slug)
        setNumber(loaded.number)
        setMoment(loaded.moment)
        setAuthorNotes(loaded.authorNotes)
        setDoc(loaded.content)
        setText(loaded.contentText)
        hasLoadedRef.current = true
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить главу.')
      })
    return () => { cancelled = true }
  }, [client, chapterId])

  const save = useCallback(async (extra?: { status?: 'draft' | 'published' }) => {
    if (!hasLoadedRef.current) return
    const current = latestRef.current
    setSaveState('saving')
    setSaveError('')
    try {
      const saved = await updateChapter(client, chapterId, {
        title: current.title,
        slug: current.slug || slugify(current.title) || chapterId.slice(0, 8),
        number: current.number,
        moment: current.moment,
        authorNotes: current.authorNotes,
        content: current.doc,
        contentText: current.text,
        ...(extra?.status ? { status: extra.status } : {}),
      })
      setChapter(saved)
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить.')
      throw error
    }
  }, [client, chapterId])

  /** Every edit marks the draft dirty and restarts the autosave countdown. */
  const touch = useCallback(() => {
    if (!hasLoadedRef.current) return
    setSaveState('dirty')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void save().catch(() => {}) }, AUTOSAVE_DELAY_MS)
  }, [save])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // Leaving with unsaved text is the one thing this editor must not allow
  // silently.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveState])

  const handleContentChange = useCallback((nextDoc: ChapterDoc, nextText: string) => {
    setDoc(nextDoc)
    setText(nextText)
    touch()
  }, [touch])

  const patchMoment = (patch: Partial<ChapterMoment>) => {
    setMoment(previous => ({ ...previous, ...patch }))
    touch()
  }

  const publish = async () => {
    if (moment.year === null) {
      setSaveError('Чтобы опубликовать главу, укажите год на шкале времени.')
      setSaveState('error')
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      await save({ status: 'published' })
    } catch { /* message already shown */ }
  }

  const unpublish = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      await save({ status: 'draft' })
    } catch { /* message already shown */ }
  }

  const openTimeline = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      await save()
    } catch { return }
    router.push(`/characters_map?${momentQuery(latestRef.current.moment, chapterId)}`)
  }

  const remove = async () => {
    if (!window.confirm(`Удалить главу «${title || 'без названия'}»? Это необратимо.`)) return
    if (timerRef.current) clearTimeout(timerRef.current)
    await deleteChapter(client, chapterId)
    router.push('/chronicle/admin/chapters')
  }

  if (loadError) return <p className={styles.loadError}>{loadError}</p>
  if (!chapter) return <p className={styles.loading}>Загружаю главу…</p>

  const saveLabel = {
    idle: 'Всё сохранено',
    dirty: 'Есть несохранённое',
    saving: 'Сохраняю…',
    saved: 'Сохранено',
    error: 'Ошибка сохранения',
  }[saveState]

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <input
          className={styles.titleInput}
          value={title}
          maxLength={CHAPTER_TITLE_MAX_LENGTH}
          placeholder="Название главы"
          onChange={event => {
            setTitle(event.target.value)
            touch()
          }}
        />

        {isPreview ? (
          <div className={styles.preview}>
            <ChapterContent doc={doc} />
            {countWords(text) === 0 && <p className={styles.previewEmpty}>Глава пока пустая.</p>}
          </div>
        ) : (
          <ChapterEditor
            documentKey={chapter.id}
            initialContent={chapter.content}
            onChange={handleContentChange}
          />
        )}
      </main>

      <aside className={styles.panel}>
        <div className={styles.panelBlock}>
          <div className={styles.statusLine}>
            <span className={`${styles.badge} ${chapter.status === 'published' ? styles.badgePublished : ''}`}>
              {chapter.status === 'published' ? 'Опубликована' : 'Черновик'}
            </span>
            <span className={`${styles.saveState} ${saveState === 'error' ? styles.saveError : ''}`}>{saveLabel}</span>
          </div>
          <p className={styles.wordCount}>{countWords(text)} слов</p>
          {saveError && <p className={styles.errorText}>{saveError}</p>}
        </div>

        <div className={styles.panelBlock}>
          <p className="ch-kicker">Глава</p>
          <label className={styles.field}>
            <span>Номер</span>
            <input
              type="number"
              value={number}
              onChange={event => {
                setNumber(Number(event.target.value) || 1)
                touch()
              }}
            />
          </label>
          <label className={styles.field}>
            <span>Адрес (slug)</span>
            <input
              type="text"
              value={slug}
              onChange={event => {
                setSlug(slugify(event.target.value))
                touch()
              }}
            />
          </label>
          <p className={styles.hint}>/chronicle/chapter/{slug || '…'}</p>
        </div>

        <div className={styles.panelBlock}>
          <p className="ch-kicker">Время в истории</p>
          <div className={styles.dateRow}>
            <label className={styles.field}>
              <span>Год</span>
              <input
                type="number"
                value={moment.year ?? ''}
                placeholder="—"
                onChange={event => patchMoment({
                  year: event.target.value === '' ? null : Number(event.target.value),
                })}
              />
            </label>
            <label className={styles.field}>
              <span>Месяц</span>
              <select
                value={moment.month ?? ''}
                onChange={event => {
                  const month = event.target.value === '' ? null : Number(event.target.value)
                  patchMoment(month === null ? { month: null, day: null } : { month })
                }}
              >
                <option value="">—</option>
                {monthOptions('ru').map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>День</span>
              <input
                type="number"
                min={1}
                max={31}
                disabled={moment.month === null}
                value={moment.day ?? ''}
                placeholder="—"
                onChange={event => patchMoment({
                  day: event.target.value === '' ? null : Number(event.target.value),
                })}
              />
            </label>
          </div>
          <label className={styles.field}>
            <span>Подпись к моменту</span>
            <input
              type="text"
              value={moment.label}
              maxLength={TIMELINE_LABEL_MAX_LENGTH}
              placeholder="Став возвращается в…"
              onChange={event => patchMoment({ label: event.target.value })}
            />
          </label>
          {snapshots.length > 0 && (
            <label className={styles.field}>
              <span>Точка времени</span>
              <select
                value={moment.snapshotId ?? ''}
                onChange={event => patchMoment({ snapshotId: event.target.value || null })}
              >
                <option value="">—</option>
                {snapshots.map(snapshot => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.year} — {snapshot.label || 'без названия'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className={styles.timelineButton} onClick={openTimeline}>
            Открыть карту отношений
            <span className={styles.timelineYear}>{formatMoment(moment) || 'год не задан'}</span>
          </button>
        </div>

        <div className={styles.panelBlock}>
          <p className="ch-kicker">Заметки автора</p>
          <p className={styles.hint}>Видны только вам. Читателю не отдаются вообще.</p>
          <textarea
            className={styles.notes}
            rows={6}
            value={authorNotes}
            onChange={event => {
              setAuthorNotes(event.target.value)
              touch()
            }}
          />
        </div>

        <div className={styles.panelActions}>
          <button type="button" className={styles.secondary} onClick={() => { void save().catch(() => {}) }}>
            Сохранить
          </button>
          <button type="button" className={styles.secondary} onClick={() => setIsPreview(previous => !previous)}>
            {isPreview ? 'Редактировать' : 'Предпросмотр'}
          </button>
          {chapter.status === 'published' ? (
            <button type="button" className={styles.secondary} onClick={unpublish}>Снять с публикации</button>
          ) : (
            <button type="button" className={styles.primary} onClick={publish}>Опубликовать</button>
          )}
        </div>

        <div className={styles.panelFooter}>
          {chapter.status === 'published' && (
            <Link className={styles.footerLink} href={`/chronicle/chapter/${chapter.slug}`} target="_blank">
              Открыть на сайте ↗
            </Link>
          )}
          <button type="button" className={styles.danger} onClick={remove}>Удалить главу</button>
        </div>
      </aside>
    </div>
  )
}
