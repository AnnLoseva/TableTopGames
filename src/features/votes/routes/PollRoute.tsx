'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { fetchPollBySlug, fetchPollResults, submitPollResponse } from '../api/pollsApi'
import { createEvenAllocations, redistributeAllocations, roundAllocationsToIntegers } from '../lib/allocations'
import { getVotedResponseId, markVoted } from '../lib/localVote'
import { extractAccentPalette, type ExtractedPalette } from '../lib/paletteFromImage'
import type { Poll, PollResults } from '../types'
import styles from './PollRoute.module.css'

type LoadState = 'loading' | 'not-found' | 'ready' | 'error'
type Phase = 'voting' | 'submitting' | 'results'
type PageCssVars = CSSProperties & {
  '--accent'?: string
  '--accent-strong'?: string
}

export default function PollRoute({ slug }: { slug: string }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [poll, setPoll] = useState<Poll | null>(null)
  const [phase, setPhase] = useState<Phase>('voting')
  const [allocations, setAllocations] = useState<Record<string, number>>({})
  const [results, setResults] = useState<PollResults | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [palette, setPalette] = useState<ExtractedPalette | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      try {
        const loadedPoll = await fetchPollBySlug(slug)
        if (cancelled) return
        if (!loadedPoll) {
          setLoadState('not-found')
          return
        }

        setPoll(loadedPoll)
        const optionIds = loadedPoll.options.map(option => option.id)
        setAllocations(createEvenAllocations(optionIds))

        const votedResponseId = getVotedResponseId(slug)
        if (votedResponseId) {
          const loadedResults = await fetchPollResults(loadedPoll.id, loadedPoll.options)
          if (cancelled) return
          setResults(loadedResults)
          setPhase('results')
        }

        setLoadState('ready')
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить голосование')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const backgroundImageUrl = poll?.backgroundImageUrl
  useEffect(() => {
    let cancelled = false
    setPalette(null)
    if (!backgroundImageUrl) return
    extractAccentPalette(backgroundImageUrl).then(result => {
      if (!cancelled) setPalette(result)
    })
    return () => {
      cancelled = true
    }
  }, [backgroundImageUrl])

  const orderedOptionIds = useMemo(() => poll?.options.map(option => option.id) ?? [], [poll])

  const displayAllocations = useMemo(
    () => roundAllocationsToIntegers(allocations, orderedOptionIds),
    [allocations, orderedOptionIds],
  )

  const handleSliderChange = useCallback((optionId: string, value: number) => {
    setAllocations(current => redistributeAllocations(current, orderedOptionIds, optionId, value))
  }, [orderedOptionIds])

  const handleSubmit = async () => {
    if (!poll) return
    setPhase('submitting')
    setErrorMessage('')
    try {
      const responseId = await submitPollResponse(poll.id, roundAllocationsToIntegers(allocations, orderedOptionIds))
      markVoted(slug, responseId)
      const loadedResults = await fetchPollResults(poll.id, poll.options)
      setResults(loadedResults)
      setPhase('results')
    } catch (error) {
      setPhase('voting')
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить голос')
    }
  }

  const handleRefreshResults = async () => {
    if (!poll) return
    try {
      const loadedResults = await fetchPollResults(poll.id, poll.options)
      setResults(loadedResults)
    } catch {
      // Keep showing the previous snapshot if the refresh fails.
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <main className={styles.page}>
        <p className={styles.statusText}>Загружаю голосование…</p>
      </main>
    )
  }

  if (loadState === 'not-found') {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Голосование не найдено</h1>
          <p className={styles.lead}>Ссылка устарела или введена неверно.</p>
          <Link href="/votes" className={styles.secondaryButton}>Создать своё голосование</Link>
        </section>
      </main>
    )
  }

  if (loadState === 'error' || !poll) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Что-то пошло не так</h1>
          <p className={styles.lead}>{errorMessage || 'Попробуйте обновить страницу.'}</p>
        </section>
      </main>
    )
  }

  const pageStyle: PageCssVars = {
    ...(poll.backgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(6, 6, 10, 0.72), rgba(6, 6, 10, 0.82)), url(${poll.backgroundImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
    ...(palette
      ? {
          '--accent': palette.accent,
          '--accent-strong': palette.accentStrong,
        }
      : {}),
  }

  return (
    <main className={styles.page} style={pageStyle}>
      <section className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>Голосование</p>
            <h1>{poll.title}</h1>
          </div>
          <button type="button" className={styles.linkButton} onClick={handleCopyLink}>
            {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
          </button>
        </div>

        {poll.description && <p className={styles.lead}>{poll.description}</p>}

        {phase !== 'results' ? (
          <>
            <p className={styles.instructions}>
              У вас есть 100%. Двигайте ползунки — остальные проценты
              подстроятся автоматически, чтобы сумма всегда оставалась 100%.
            </p>

            <div className={styles.optionsList}>
              {poll.options.map(option => (
                <div key={option.id} className={styles.optionCard}>
                  {option.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.optionImage} src={option.imageUrl} alt="" onError={event => {
                      event.currentTarget.style.display = 'none'
                    }} />
                  )}
                  <div className={styles.optionBody}>
                    <div className={styles.optionTop}>
                      <span className={styles.optionLabel}>{option.label}</span>
                      <span className={styles.optionValue}>{displayAllocations[option.id] ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={allocations[option.id] ?? 0}
                      onChange={event => handleSliderChange(option.id, Number(event.target.value))}
                      className={styles.slider}
                      disabled={phase === 'submitting'}
                    />
                  </div>
                </div>
              ))}
            </div>

            {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}

            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={phase === 'submitting'}
            >
              {phase === 'submitting' ? 'Отправляю…' : 'Отправить голос'}
            </button>
          </>
        ) : (
          <>
            <p className={styles.instructions}>
              Спасибо, ваш голос учтён. Вот текущее распределение всех
              ответов{results ? ` (${results.totalResponses})` : ''}.
            </p>

            <div className={styles.resultsList}>
              {results && [...poll.options]
                .sort((a, b) => (results.averages[b.id] ?? 0) - (results.averages[a.id] ?? 0))
                .map(option => {
                  const average = results.averages[option.id] ?? 0
                  return (
                    <div key={option.id} className={styles.resultRow}>
                      <div className={styles.resultTop}>
                        <span className={styles.optionLabel}>{option.label}</span>
                        <span className={styles.optionValue}>{average.toFixed(1)}%</span>
                      </div>
                      <div className={styles.resultTrack}>
                        <div className={styles.resultFill} style={{ width: `${Math.min(100, average)}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>

            <button type="button" className={styles.secondaryButton} onClick={handleRefreshResults}>
              Обновить результаты
            </button>
          </>
        )}
      </section>
    </main>
  )
}
