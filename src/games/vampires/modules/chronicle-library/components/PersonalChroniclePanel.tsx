'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import {
  createPersonalChronicleJob,
  deletePersonalChronicleJob,
  invokePersonalChronicleProcessor,
  loadPersonalChronicleJobs,
  loadPersonalJobChunks,
} from '../api/personal-chronicle-api'
import type { LibraryChronicle, PersonalChronicleJob } from '../types'
import {
  MAX_PERSONAL_TRANSCRIPT_BYTES,
  preparePersonalTranscript,
} from '../utils/personal-transcript'

const SUMMARY_BATCH_SIZE = 20

type PersonalChroniclePanelProps = {
  chronicles: LibraryChronicle[]
  activeChronicleId: string
  onCompleted: (chronicleId: string) => void
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function invokeWithRetry(body: Record<string, unknown>) {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await invokePersonalChronicleProcessor(body)
    } catch (error) {
      lastError = error
      if (attempt === 0) await new Promise(resolve => window.setTimeout(resolve, 700))
    }
  }
  throw lastError
}

export default function PersonalChroniclePanel({
  chronicles,
  activeChronicleId,
  onCompleted,
}: PersonalChroniclePanelProps) {
  const { t, tf } = useLang()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [destinationId, setDestinationId] = useState(activeChronicleId)
  const [file, setFile] = useState<File | null>(null)
  const [characterName, setCharacterName] = useState('')
  const [speakerHints, setSpeakerHints] = useState('')
  const [jobs, setJobs] = useState<PersonalChronicleJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [runningJobId, setRunningJobId] = useState('')
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [message, setMessage] = useState('')

  const refreshJobs = useCallback(async () => {
    try {
      setJobs(await loadPersonalChronicleJobs())
    } catch (error) {
      console.error('load personal chronicle jobs:', error)
      setMessage(t('Не удалось загрузить незавершённые обработки.'))
    } finally {
      setLoadingJobs(false)
    }
  }, [t])

  useEffect(() => {
    void refreshJobs()
  }, [refreshJobs])

  useEffect(() => {
    if (chronicles.some(chronicle => chronicle.id === destinationId)) return
    setDestinationId(activeChronicleId || chronicles[0]?.id || '')
  }, [activeChronicleId, chronicles, destinationId])

  const runJob = useCallback(async (job: PersonalChronicleJob) => {
    if (runningJobId) return
    setRunningJobId(job.id)
    setMessage('')
    try {
      const chunks = await loadPersonalJobChunks(job.id)
      if (chunks.length !== job.total_chunks) {
        throw new Error(t('Не все части файла попали в базу. Удалите эту обработку и загрузите файл снова.'))
      }

      const completed = new Set(
        chunks.filter(chunk => chunk.status === 'processed').map(chunk => chunk.chunk_index),
      )
      setProgress(12 + (completed.size / job.total_chunks) * 72)

      for (let chunkIndex = 0; chunkIndex < job.total_chunks; chunkIndex += 1) {
        if (!completed.has(chunkIndex)) {
          setStage(tf('ИИ обрабатывает часть {current} из {total}', {
            current: chunkIndex + 1,
            total: job.total_chunks,
          }))
          await invokeWithRetry({
            action: 'process_chunk',
            job_id: job.id,
            chunk_index: chunkIndex,
          })
          completed.add(chunkIndex)
        }
        setProgress(12 + (completed.size / job.total_chunks) * 72)
      }

      const summaryParts: string[] = []
      const batchCount = Math.ceil(job.total_chunks / SUMMARY_BATCH_SIZE)
      for (let batch = 0; batch < batchCount; batch += 1) {
        const startIndex = batch * SUMMARY_BATCH_SIZE
        const endIndex = Math.min(job.total_chunks - 1, startIndex + SUMMARY_BATCH_SIZE - 1)
        setStage(tf('ИИ собирает конспект: этап {current} из {total}', {
          current: batch + 1,
          total: batchCount,
        }))
        const result = await invokeWithRetry({
          action: 'summarize_batch',
          job_id: job.id,
          start_index: startIndex,
          end_index: endIndex,
        })
        if (typeof result.summary !== 'string' || !result.summary.trim()) {
          throw new Error(t('ИИ не вернул промежуточный конспект.'))
        }
        summaryParts.push(result.summary)
        setProgress(84 + ((batch + 1) / batchCount) * 10)
      }

      setStage(t('ИИ пишет короткую личную хронику и сохраняет оба файла'))
      setProgress(96)
      await invokeWithRetry({
        action: 'finalize',
        job_id: job.id,
        summary_parts: summaryParts,
      })
      setProgress(100)
      setStage(t('Готово'))
      setMessage(t('Полная чистая расшифровка и короткая личная хроника сохранены. Их видите только вы и библиотекарь в рамках вашего доступа.'))
      await refreshJobs()
      onCompleted(job.chronicle_id)
    } catch (error) {
      console.error('personal chronicle processing:', error)
      setStage(t('Обработка остановлена. Уже готовые части сохранены.'))
      setMessage(errorMessage(error, t('Не удалось обработать файл. Нажмите «Продолжить», чтобы повторить.')))
      await refreshJobs()
    } finally {
      setRunningJobId('')
    }
  }, [onCompleted, refreshJobs, runningJobId, t, tf])

  const startUpload = async () => {
    if (!file || !destinationId || runningJobId) return
    setMessage('')
    if (file.size > MAX_PERSONAL_TRANSCRIPT_BYTES) {
      setMessage(t('Файл слишком большой. Максимум — 8 МБ текста.'))
      return
    }
    if (!/\.(?:md|markdown|txt|srt|vtt)$/i.test(file.name)) {
      setMessage(t('Можно загрузить Markdown, TXT, SRT или VTT.'))
      return
    }

    setRunningJobId('preparing')
    try {
      setStage(t('Читаю полный файл'))
      setProgress(3)
      const raw = await file.text()
      setStage(t('Разбиваю текст на безопасные части без обрезания'))
      setProgress(7)
      const transcript = preparePersonalTranscript(raw, file.name)
      setStage(tf('Сохраняю исходник в базе: {count} частей', { count: transcript.chunks.length }))
      setProgress(9)
      const job = await createPersonalChronicleJob({
        chronicleId: destinationId,
        fileName: file.name,
        characterName,
        speakerHints,
        transcript,
      })
      setProgress(12)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setRunningJobId('')
      await refreshJobs()
      await runJob(job)
    } catch (error) {
      console.error('create personal chronicle job:', error)
      setStage(t('Обработка не началась'))
      setMessage(errorMessage(error, t('Не удалось принять файл.')))
      setRunningJobId('')
      await refreshJobs()
    }
  }

  const removeJob = async (jobId: string) => {
    if (runningJobId) return
    setMessage('')
    try {
      await deletePersonalChronicleJob(jobId)
      await refreshJobs()
    } catch (error) {
      console.error('delete personal chronicle job:', error)
      setMessage(errorMessage(error, t('Не удалось удалить обработку.')))
    }
  }

  const visibleProgress = runningJobId ? Math.max(0, Math.min(100, progress)) : 0

  return (
    <section className="personal-chronicle-panel">
      <div className="personal-chronicle-intro">
        <span>{t('Личная хроника игрока')}</span>
        <strong>{t('Загрузите полную расшифровку: ИИ очистит весь текст, отметит говорящих и создаст короткую хронику от лица вашего персонажа.')}</strong>
        <small>{t('Исходник, полный обработанный текст и пересказ принадлежат только вам. Другие участники хроники их не увидят.')}</small>
      </div>

      <div className="personal-chronicle-fields">
        <label>
          <span>{t('Куда сохранить')}</span>
          <select value={destinationId} onChange={event => setDestinationId(event.target.value)}>
            {chronicles.map(chronicle => (
              <option value={chronicle.id} key={chronicle.id}>{chronicle.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('От чьего лица писать')}</span>
          <input
            value={characterName}
            onChange={event => setCharacterName(event.target.value)}
            placeholder={t('Например: Альмериальда')}
            maxLength={160}
          />
        </label>
        <label className="personal-chronicle-wide">
          <span>{t('Подсказки по говорящим')}</span>
          <input
            value={speakerHints}
            onChange={event => setSpeakerHints(event.target.value)}
            placeholder={t('Например: Анна играет Альмериальду; Артём — рассказчик')}
            maxLength={1000}
          />
        </label>
        <label className="personal-chronicle-wide">
          <span>{t('Полный файл')}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,.srt,.vtt,text/markdown,text/plain,text/vtt,application/x-subrip"
            onChange={event => setFile(event.target.files?.[0] || null)}
          />
        </label>
      </div>

      <button
        className="personal-chronicle-start"
        type="button"
        onClick={() => void startUpload()}
        disabled={!file || !destinationId || Boolean(runningJobId)}
      >
        {runningJobId ? t('Обрабатываю...') : t('Обработать полностью')}
      </button>

      {runningJobId ? (
        <div className="personal-chronicle-progress" aria-live="polite">
          <div><strong>{stage}</strong><span>{Math.round(visibleProgress)}%</span></div>
          <progress max={100} value={visibleProgress}>{Math.round(visibleProgress)}%</progress>
          <small>{t('Можно вернуться позже: завершённые части уже сохранены.')}</small>
        </div>
      ) : null}

      {!loadingJobs && jobs.length > 0 ? (
        <div className="personal-chronicle-jobs">
          <span>{t('Незавершённые обработки')}</span>
          {jobs.map(job => {
            const chronicle = chronicles.find(item => item.id === job.chronicle_id)
            return (
              <article key={job.id}>
                <div>
                  <strong>{job.title}</strong>
                  <small>
                    {chronicle?.title || t('Хроника')} · {tf('готово частей: {current} из {total}', {
                      current: job.processed_chunks,
                      total: job.total_chunks,
                    })}
                  </small>
                </div>
                <button type="button" onClick={() => void runJob(job)} disabled={Boolean(runningJobId)}>
                  {t('Продолжить')}
                </button>
                <button type="button" onClick={() => void removeJob(job.id)} disabled={Boolean(runningJobId)}>
                  {t('Удалить')}
                </button>
              </article>
            )
          })}
        </div>
      ) : null}

      {message ? <p className="personal-chronicle-message">{message}</p> : null}

      <style jsx>{`
        .personal-chronicle-panel {
          display: grid; gap: 14px; margin-bottom: 18px; padding: 16px;
          border: 1px solid rgba(171, 79, 40, .5); border-radius: 9px;
          background: linear-gradient(135deg, rgba(48, 20, 10, .68), rgba(12, 8, 9, .9));
        }
        .personal-chronicle-intro { display: grid; gap: 6px; }
        .personal-chronicle-intro span, label span, .personal-chronicle-jobs > span { color: #e5b46d; font-size: 13px; }
        .personal-chronicle-intro strong { color: #f0dfc9; line-height: 1.5; }
        .personal-chronicle-intro small, .personal-chronicle-jobs small, .personal-chronicle-progress small { color: #ad9e92; line-height: 1.45; }
        .personal-chronicle-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        label { display: grid; gap: 7px; min-width: 0; }
        .personal-chronicle-wide { grid-column: 1 / -1; }
        input, select {
          box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px;
          border: 1px solid rgba(171, 79, 40, .72); border-radius: 7px;
          background: #0d0a0a; color: #fff8ef; padding: 0 12px; font: inherit;
        }
        input[type="file"] { padding: 9px; }
        button {
          border: 1px solid #8f492e; border-radius: 6px; color: #f5f5f5;
          padding: 10px 14px; background: #17100d; font: inherit; font-size: 14px; cursor: pointer;
        }
        button:hover:not(:disabled) { border-color: #ff8147; background: #2b1710; }
        button:disabled { opacity: .45; cursor: default; }
        .personal-chronicle-start { justify-self: start; }
        .personal-chronicle-progress { display: grid; gap: 7px; }
        .personal-chronicle-progress > div { display: flex; justify-content: space-between; gap: 16px; color: #f0dfc9; }
        progress { width: 100%; height: 14px; accent-color: #c85f37; }
        .personal-chronicle-jobs { display: grid; gap: 8px; border-top: 1px solid rgba(171, 79, 40, .32); padding-top: 12px; }
        .personal-chronicle-jobs article { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; }
        .personal-chronicle-jobs article > div { display: grid; gap: 3px; min-width: 0; }
        .personal-chronicle-jobs strong { overflow-wrap: anywhere; color: #f0dfc9; }
        .personal-chronicle-message { margin: 0; color: #f5c998; line-height: 1.5; }
        @media (max-width: 720px) {
          .personal-chronicle-fields { grid-template-columns: 1fr; }
          .personal-chronicle-wide { grid-column: auto; }
          .personal-chronicle-jobs article { grid-template-columns: 1fr 1fr; }
          .personal-chronicle-jobs article > div { grid-column: 1 / -1; }
        }
      `}</style>
    </section>
  )
}
