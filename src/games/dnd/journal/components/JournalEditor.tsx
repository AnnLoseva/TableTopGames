'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { createAccountClient } from '@/platform/account/supabase'
import { DND_PAGE_TYPE_LABELS, DND_PAGE_TYPES } from '../constants'
import type { DndJournalPage, DndJournalPageEditablePatch, DndPageType } from '../types'
import styles from './DndJournalRoute.module.css'
import JournalImageGallery from './JournalImageGallery'

type JournalEditorProps = {
  client: ReturnType<typeof createAccountClient>
  page: DndJournalPage
  onSave: (id: string, patch: DndJournalPageEditablePatch, baselineBodyMarkdown?: string) => Promise<DndJournalPage>
  onDelete: (id: string) => void
  isEditor: boolean
}

const SAVE_DEBOUNCE_MS = 800

export default function JournalEditor({ client, page, onSave, onDelete, isEditor }: JournalEditorProps) {
  const [title, setTitle] = useState(page.title)
  const [bodyMarkdown, setBodyMarkdown] = useState(page.bodyMarkdown)
  const [type, setType] = useState<DndPageType>(page.type)
  const [aliases, setAliases] = useState<string[]>(page.aliases)
  const [isFavorite, setIsFavorite] = useState(page.isFavorite)
  const [isPinned, setIsPinned] = useState(page.isPinned)
  const [isArchived, setIsArchived] = useState(page.isArchived)
  const [aliasDraft, setAliasDraft] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>(isEditor ? 'edit' : 'preview')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved' | 'merged'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The body text this edit is based on — used to detect whether someone else
  // (another tab, or eventually the iPad app) changed the page underneath us.
  const baselineBodyRef = useRef(page.bodyMarkdown)

  useEffect(() => {
    setTitle(page.title)
    setBodyMarkdown(page.bodyMarkdown)
    setType(page.type)
    setAliases(page.aliases)
    setIsFavorite(page.isFavorite)
    setIsPinned(page.isPinned)
    setIsArchived(page.isArchived)
    setAliasDraft('')
    setMode(isEditor ? 'edit' : 'preview')
    setSaveStatus('idle')
    baselineBodyRef.current = page.bodyMarkdown
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [page.id, isEditor])

  const commit = (patch: DndJournalPageEditablePatch, debounce: boolean) => {
    if (!isEditor) return
    setSaveStatus('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const run = () => {
      const baseline = patch.bodyMarkdown !== undefined ? baselineBodyRef.current : undefined
      void onSave(page.id, patch, baseline)
        .then(updated => {
          if (patch.bodyMarkdown === undefined) {
            setSaveStatus('saved')
            return
          }
          if (updated.bodyMarkdown !== patch.bodyMarkdown) {
            // The server merged in paragraphs from elsewhere — show the
            // combined text so it's obvious there's manual cleanup to do.
            setBodyMarkdown(updated.bodyMarkdown)
            setSaveStatus('merged')
          } else {
            setSaveStatus('saved')
          }
          baselineBodyRef.current = updated.bodyMarkdown
        })
        .catch(error => {
          console.error('Не удалось сохранить страницу журнала:', error)
          setSaveStatus('idle')
        })
    }
    if (debounce) saveTimer.current = setTimeout(run, SAVE_DEBOUNCE_MS)
    else run()
  }

  const addAlias = () => {
    const value = aliasDraft.trim()
    if (!value || aliases.includes(value)) {
      setAliasDraft('')
      return
    }
    const next = [...aliases, value]
    setAliases(next)
    setAliasDraft('')
    commit({ aliases: next }, false)
  }

  const removeAlias = (value: string) => {
    const next = aliases.filter(alias => alias !== value)
    setAliases(next)
    commit({ aliases: next }, false)
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        {isEditor ? (
          <input
            className={styles.titleInput}
            value={title}
            placeholder="Без названия"
            onChange={event => {
              setTitle(event.target.value)
              commit({ title: event.target.value }, true)
            }}
          />
        ) : (
          <h2 className={styles.titleInput}>{title || 'Без названия'}</h2>
        )}
        <div className={styles.metaRow}>
          {isEditor ? (
            <select
              className={styles.typeSelect}
              value={type}
              onChange={event => {
                const nextType = event.target.value as DndPageType
                setType(nextType)
                commit({ type: nextType }, false)
              }}
            >
              {DND_PAGE_TYPES.map(pageType => (
                <option key={pageType} value={pageType}>{DND_PAGE_TYPE_LABELS[pageType]}</option>
              ))}
            </select>
          ) : (
            <span className={styles.typeSelect}>{DND_PAGE_TYPE_LABELS[type]}</span>
          )}
          {isFavorite && <span className={`${styles.toggleButton} ${styles.toggleButtonActive}`}>★ Избранное</span>}
          {isPinned && <span className={`${styles.toggleButton} ${styles.toggleButtonActive}`}>📌 Закреплено</span>}
          {isEditor && (
            <>
              <button
                type="button"
                className={`${styles.toggleButton} ${isFavorite ? styles.toggleButtonActive : ''}`}
                onClick={() => {
                  const next = !isFavorite
                  setIsFavorite(next)
                  commit({ isFavorite: next }, false)
                }}
              >
                ★ Избранное
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${isPinned ? styles.toggleButtonActive : ''}`}
                onClick={() => {
                  const next = !isPinned
                  setIsPinned(next)
                  commit({ isPinned: next }, false)
                }}
              >
                📌 Закрепить
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${isArchived ? styles.toggleButtonActive : ''}`}
                onClick={() => {
                  const next = !isArchived
                  setIsArchived(next)
                  commit({ isArchived: next }, false)
                }}
              >
                🗄 В архив
              </button>
              <button type="button" className={styles.deleteButton} onClick={() => onDelete(page.id)}>
                Удалить
              </button>
            </>
          )}
        </div>
        {(isEditor || aliases.length > 0) && (
          <div className={styles.aliasesRow}>
            {aliases.map(alias => (
              <span key={alias} className={styles.aliasChip}>
                {alias}
                {isEditor && (
                  <button type="button" onClick={() => removeAlias(alias)} aria-label={`Убрать псевдоним ${alias}`}>×</button>
                )}
              </span>
            ))}
            {isEditor && (
              <input
                className={styles.aliasInput}
                placeholder="+ псевдоним"
                value={aliasDraft}
                onChange={event => setAliasDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addAlias()
                  }
                }}
                onBlur={addAlias}
              />
            )}
          </div>
        )}
      </div>

      {isEditor && (
        <div className={styles.bodyTabs}>
          <button
            type="button"
            className={`${styles.toggleButton} ${mode === 'edit' ? styles.toggleButtonActive : ''}`}
            onClick={() => setMode('edit')}
          >
            Правка
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${mode === 'preview' ? styles.toggleButtonActive : ''}`}
            onClick={() => setMode('preview')}
          >
            Просмотр
          </button>
          <span className={styles.saveStatus}>
            {saveStatus === 'pending' ? 'Сохраняю…'
              : saveStatus === 'merged' ? 'Объединено с изменениями из другого места — проверьте абзацы'
              : saveStatus === 'saved' ? 'Сохранено' : ''}
          </span>
        </div>
      )}

      {mode === 'edit' ? (
        <textarea
          className={styles.bodyTextarea}
          value={bodyMarkdown}
          placeholder="Текст страницы в Markdown…"
          onChange={event => {
            setBodyMarkdown(event.target.value)
            commit({ bodyMarkdown: event.target.value }, true)
          }}
        />
      ) : (
        <div className={styles.bodyPreview}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMarkdown || '*Пусто*'}</ReactMarkdown>
        </div>
      )}

      <JournalImageGallery client={client} pageId={page.id} isEditor={isEditor} />
    </div>
  )
}
