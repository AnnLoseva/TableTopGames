'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadSettings, saveSettings } from '../api/settingsApi'
import { DEFAULT_SETTINGS } from '../constants'
import { createChronicleClient } from '../supabase'
import type { ChronicleSettings } from '../types'
import styles from './AdminPages.module.css'

export default function SettingsRoute() {
  const client = useMemo(() => createChronicleClient(), [])
  const [settings, setSettings] = useState<ChronicleSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadSettings(client)
      .then(setSettings)
      .catch(() => setError('Не удалось загрузить настройки.'))
      .finally(() => setIsLoading(false))
  }, [client])

  const submit = async () => {
    setStatus('')
    setError('')
    try {
      setSettings(await saveSettings(client, settings))
      setStatus('Сохранено — публичные страницы уже показывают новый текст.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить.')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="ch-kicker">Настройки</p>
          <h1 className={styles.pageTitle}>Публичная часть</h1>
        </div>
      </header>

      {isLoading ? <p className={styles.muted}>Загружаю…</p> : (
        <div className={styles.form}>
          <label className={styles.field}>
            <span>Название</span>
            <input
              type="text"
              value={settings.title}
              onChange={event => setSettings({ ...settings, title: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Подзаголовок</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={event => setSettings({ ...settings, subtitle: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Вступление</span>
            <textarea
              rows={4}
              value={settings.intro}
              onChange={event => setSettings({ ...settings, intro: event.target.value })}
            />
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={settings.showYearToReader}
              onChange={event => setSettings({ ...settings, showYearToReader: event.target.checked })}
            />
            Показывать читателю год главы
          </label>
          <p className={styles.hint}>
            Карта отношений, черновики и заметки автора читателю недоступны всегда —
            это не настройка, а правило на уровне базы данных.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          {status && <p className={styles.hint}>{status}</p>}
          <div className={styles.formActions}>
            <button type="button" className={styles.primaryButton} onClick={submit}>Сохранить</button>
          </div>
        </div>
      )}
    </div>
  )
}
