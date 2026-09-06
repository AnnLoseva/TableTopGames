'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { createPoll } from '../api/pollsApi'
import { MAX_OPTIONS, MIN_OPTIONS } from '../constants'
import { generateOptionId } from '../lib/slug'
import type { Poll, PollOptionDraft } from '../types'
import styles from './CreatePollRoute.module.css'

function createEmptyOption(): PollOptionDraft {
  return { id: generateOptionId(), label: '', imageUrl: '' }
}

export default function CreatePollRoute() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('')
  const [options, setOptions] = useState<PollOptionDraft[]>([createEmptyOption(), createEmptyOption()])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [createdPoll, setCreatedPoll] = useState<Poll | null>(null)
  const [copied, setCopied] = useState(false)

  const updateOption = (id: string, patch: Partial<PollOptionDraft>) => {
    setOptions(current => current.map(option => (option.id === id ? { ...option, ...patch } : option)))
  }

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return
    setOptions(current => [...current, createEmptyOption()])
  }

  const removeOption = (id: string) => {
    if (options.length <= MIN_OPTIONS) return
    setOptions(current => current.filter(option => option.id !== id))
  }

  const pollUrl = createdPoll && typeof window !== 'undefined'
    ? `${window.location.origin}/votes/${createdPoll.slug}`
    : ''

  const handleCopy = async () => {
    if (!pollUrl) return
    try {
      await navigator.clipboard.writeText(pollUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    const filledOptions = options.filter(option => option.label.trim().length > 0)
    if (!title.trim()) {
      setStatus('error')
      setErrorMessage('Введите название голосования')
      return
    }
    if (filledOptions.length < MIN_OPTIONS) {
      setStatus('error')
      setErrorMessage(`Заполните минимум ${MIN_OPTIONS} варианта`)
      return
    }

    try {
      const poll = await createPoll({ title, description, backgroundImageUrl, options })
      setCreatedPoll(poll)
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать голосование')
    }
  }

  if (createdPoll) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Готово</p>
          <h1>«{createdPoll.title}» создано</h1>
          <p className={styles.lead}>
            Отправьте эту ссылку тем, кто должен проголосовать. У каждого будет
            свои 100%, которые нужно раскидать по вариантам ползунками.
          </p>

          <div className={styles.linkRow}>
            <input className={styles.linkInput} readOnly value={pollUrl} onFocus={event => event.target.select()} />
            <button type="button" className={styles.primaryButton} onClick={handleCopy}>
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>

          <div className={styles.successActions}>
            <Link href={`/votes/${createdPoll.slug}`} className={styles.secondaryButton}>
              Открыть голосование
            </Link>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setCreatedPoll(null)
                setTitle('')
                setDescription('')
                setBackgroundImageUrl('')
                setOptions([createEmptyOption(), createEmptyOption()])
              }}
            >
              Создать ещё одно
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Голосование в процентах</p>
        <h1>Создайте голосование</h1>
        <p className={styles.lead}>
          Не «1 голос за вариант», а 100% интереса, которые каждый распределяет
          сам — 70% сюда, 30% туда. Результаты видны только после того, как
          человек отправит свой ответ. Регистрация не нужна: голосуют по ссылке.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Название</span>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Куда едем в отпуск?"
              maxLength={200}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Описание (необязательно)</span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Пара слов о том, что выбираем и почему"
              maxLength={2000}
              rows={3}
            />
          </label>

          <label className={styles.field}>
            <span>Фон (ссылка на картинку, необязательно)</span>
            <input
              value={backgroundImageUrl}
              onChange={event => setBackgroundImageUrl(event.target.value)}
              placeholder="https://..."
              type="url"
            />
          </label>

          <div className={styles.optionsHeader}>
            <span>Варианты</span>
            <span className={styles.optionsHint}>{options.length} / {MAX_OPTIONS}</span>
          </div>

          <div className={styles.options}>
            {options.map((option, index) => (
              <div key={option.id} className={styles.optionRow}>
                <span className={styles.optionIndex}>{index + 1}</span>
                <div className={styles.optionFields}>
                  <input
                    value={option.label}
                    onChange={event => updateOption(option.id, { label: event.target.value })}
                    placeholder={`Вариант ${index + 1}`}
                    maxLength={200}
                  />
                  <input
                    value={option.imageUrl}
                    onChange={event => updateOption(option.id, { imageUrl: event.target.value })}
                    placeholder="Ссылка на картинку (необязательно)"
                    type="url"
                  />
                </div>
                <button
                  type="button"
                  className={styles.removeOption}
                  onClick={() => removeOption(option.id)}
                  disabled={options.length <= MIN_OPTIONS}
                  aria-label="Удалить вариант"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className={styles.addOption}
            onClick={addOption}
            disabled={options.length >= MAX_OPTIONS}
          >
            + Добавить вариант
          </button>

          {status === 'error' && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}

          <button type="submit" className={styles.submitButton} disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Создаю…' : 'Создать голосование'}
          </button>
        </form>
      </section>
    </main>
  )
}
