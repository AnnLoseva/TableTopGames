'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { monthOptions } from '@/features/characters_map/i18n'
import { createSnapshot, deleteSnapshot, listSnapshots, updateSnapshot } from '../api/snapshotsApi'
import { createChronicleClient } from '../supabase'
import type { Snapshot } from '../types'
import styles from './AdminPages.module.css'

/**
 * Named points on the timeline ("1848 — Cirque Oriental"): a chapter can point
 * at one, and the relationship map shows them as labelled marks, so jumping
 * between the story's important moments doesn't mean remembering years.
 */
export default function SnapshotsRoute() {
  const client = useMemo(() => createChronicleClient(), [])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [newYear, setNewYear] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      setSnapshots(await listSnapshots(client))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить точки.')
    } finally {
      setIsLoading(false)
    }
  }, [client])

  useEffect(() => { void reload() }, [reload])

  const add = async () => {
    const year = Number(newYear)
    if (!newYear || Number.isNaN(year)) {
      setError('Укажите год.')
      return
    }
    try {
      const created = await createSnapshot(client, { year, label: newLabel.trim() })
      setSnapshots(previous => [...previous, created].sort((a, b) => a.year - b.year))
      setNewYear('')
      setNewLabel('')
      setError('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать точку.')
    }
  }

  const patch = async (snapshot: Snapshot, changes: Partial<Snapshot>) => {
    const updated = await updateSnapshot(client, snapshot.id, changes)
    setSnapshots(previous => previous
      .map(item => (item.id === snapshot.id ? updated : item))
      .sort((a, b) => a.year - b.year))
  }

  const remove = async (snapshot: Snapshot) => {
    if (!window.confirm(`Удалить точку «${snapshot.label || snapshot.year}»?`)) return
    await deleteSnapshot(client, snapshot.id)
    setSnapshots(previous => previous.filter(item => item.id !== snapshot.id))
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="ch-kicker">Точки времени</p>
          <h1 className={styles.pageTitle}>Опорные моменты</h1>
        </div>
      </header>

      <div className={styles.form}>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Год</span>
            <input type="number" value={newYear} onChange={event => setNewYear(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Название</span>
            <input
              type="text"
              value={newLabel}
              placeholder="Cirque Oriental"
              onChange={event => setNewLabel(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') void add() }}
            />
          </label>
        </div>
        <div className={styles.formActions}>
          <button type="button" className={styles.primaryButton} onClick={add}>+ Добавить точку</button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {isLoading && <p className={styles.muted}>Загружаю…</p>}
      {!isLoading && snapshots.length === 0 && (
        <p className={styles.muted}>Точек пока нет. Они помогают не держать важные годы в голове.</p>
      )}

      <div className={styles.rows}>
        {snapshots.map(snapshot => (
          <div key={snapshot.id} className={styles.row}>
            <span className={styles.rowNumber}>{snapshot.year}</span>
            <div className={styles.rowBody}>
              <label className={styles.field}>
                <input
                  type="text"
                  value={snapshot.label}
                  placeholder="Название"
                  onChange={event => {
                    const label = event.target.value
                    setSnapshots(previous => previous.map(item => (
                      item.id === snapshot.id ? { ...item, label } : item
                    )))
                  }}
                  onBlur={event => { void patch(snapshot, { label: event.target.value }) }}
                />
              </label>
              <label className={styles.field}>
                <textarea
                  rows={2}
                  value={snapshot.description}
                  placeholder="Описание (необязательно)"
                  onChange={event => {
                    const description = event.target.value
                    setSnapshots(previous => previous.map(item => (
                      item.id === snapshot.id ? { ...item, description } : item
                    )))
                  }}
                  onBlur={event => { void patch(snapshot, { description: event.target.value }) }}
                />
              </label>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span>Год</span>
                  <input
                    type="number"
                    value={snapshot.year}
                    onChange={event => {
                      const year = Number(event.target.value) || snapshot.year
                      setSnapshots(previous => previous.map(item => (
                        item.id === snapshot.id ? { ...item, year } : item
                      )))
                    }}
                    onBlur={event => { void patch(snapshot, { year: Number(event.target.value) || snapshot.year }) }}
                  />
                </label>
                <label className={styles.field}>
                  <span>Месяц</span>
                  <select
                    value={snapshot.month ?? ''}
                    onChange={event => {
                      const month = event.target.value === '' ? null : Number(event.target.value)
                      void patch(snapshot, month === null ? { month: null, day: null } : { month })
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
                    disabled={snapshot.month === null}
                    value={snapshot.day ?? ''}
                    onChange={event => {
                      void patch(snapshot, { day: event.target.value === '' ? null : Number(event.target.value) })
                    }}
                  />
                </label>
              </div>
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.actionDanger} onClick={() => remove(snapshot)}>Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
