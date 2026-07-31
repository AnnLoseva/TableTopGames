'use client'

import { useEffect, useRef, useState } from 'react'
import type { createAccountClient } from '@/platform/account/supabase'
import { DND_PAGE_CATEGORY_BY_TYPE, DND_PAGE_TYPE_LABELS, DND_PAGE_TYPES } from '../constants'
import { folderPath } from '../folder-tree'
import type {
  DndJournalFolder,
  DndJournalImage,
  DndJournalPage,
  DndJournalPageEditablePatch,
  DndPageType,
} from '../types'
import styles from './DndJournalRoute.module.css'
import JournalImageGallery from './JournalImageGallery'
import JournalWikiBody from './JournalWikiBody'

type JournalEditorProps = {
  client: ReturnType<typeof createAccountClient>
  page: DndJournalPage
  pages: DndJournalPage[]
  images: DndJournalImage[]
  folders: DndJournalFolder[]
  onSave: (id: string, patch: DndJournalPageEditablePatch, baselineBodyMarkdown?: string) => Promise<DndJournalPage>
  onDelete: (id: string) => void
  onOpenWikiLink: (title: string) => void
  onImagesChanged?: () => void
  isEditor: boolean
}

const SAVE_DEBOUNCE_MS = 800

export default function JournalEditor({
  client,
  page,
  pages,
  images,
  folders,
  onSave,
  onDelete,
  onOpenWikiLink,
  onImagesChanged,
  isEditor,
}: JournalEditorProps) {
  const [title, setTitle] = useState(page.title)
  const [bodyMarkdown, setBodyMarkdown] = useState(page.bodyMarkdown)
  const [type, setType] = useState<DndPageType>(page.type)
  const [aliases, setAliases] = useState<string[]>(page.aliases)
  const [isFavorite, setIsFavorite] = useState(page.isFavorite)
  const [isPinned, setIsPinned] = useState(page.isPinned)
  const [isArchived, setIsArchived] = useState(page.isArchived)
  const [folderId, setFolderId] = useState<string | null>(page.folderId)
  const [aliasDraft, setAliasDraft] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
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
    setFolderId(page.folderId)
    setAliasDraft('')
    setMode('preview')
    setSaveStatus('idle')
    baselineBodyRef.current = page.bodyMarkdown
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [page.folderId, page.id, isEditor])

  const availableFolders = folders
    .filter(folder => folder.sectionId === DND_PAGE_CATEGORY_BY_TYPE[type])
    .sort((a, b) => folderPath(a.id, folders).map(item => item.name).join('/').localeCompare(
      folderPath(b.id, folders).map(item => item.name).join('/'),
      'ru',
    ))

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
                const currentFolder = folders.find(folder => folder.id === folderId)
                const shouldClearFolder = currentFolder?.sectionId !== DND_PAGE_CATEGORY_BY_TYPE[nextType]
                if (shouldClearFolder) setFolderId(null)
                commit(shouldClearFolder ? { type: nextType, folderId: null } : { type: nextType }, false)
              }}
            >
              {DND_PAGE_TYPES.map(pageType => (
                <option key={pageType} value={pageType}>{DND_PAGE_TYPE_LABELS[pageType]}</option>
              ))}
            </select>
          ) : (
            <span className={styles.typeSelect}>{DND_PAGE_TYPE_LABELS[type]}</span>
          )}
          {isEditor ? (
            <select
              className={styles.typeSelect}
              value={folderId ?? ''}
              onChange={event => {
                const nextFolderId = event.target.value || null
                setFolderId(nextFolderId)
                commit({ folderId: nextFolderId }, false)
              }}
              aria-label="Папка страницы"
            >
              <option value="">Без папки</option>
              {availableFolders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folderPath(folder.id, folders).map(item => item.name).join(' / ')}
                </option>
              ))}
            </select>
          ) : folderId ? (
            <span className={styles.typeSelect}>{folderPath(folderId, folders).map(folder => folder.name).join(' / ')}</span>
          ) : null}
          {!isEditor && isFavorite && <span className={`${styles.toggleButton} ${styles.toggleButtonActive}`}>★ Избранное</span>}
          {!isEditor && isPinned && <span className={`${styles.toggleButton} ${styles.toggleButtonActive}`}>✦ Закреплено</span>}
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
                {isArchived ? '↺ Восстановить' : '🗄 В архив'}
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
            Править
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${mode === 'preview' ? styles.toggleButtonActive : ''}`}
            onClick={() => setMode('preview')}
          >
            Читать
          </button>
          <span className={styles.saveStatus}>
            {saveStatus === 'pending' ? 'Сохраняю…'
              : saveStatus === 'merged' ? 'Объединено с изменениями из другого места — проверьте абзацы'
              : saveStatus === 'saved' ? 'Сохранено' : ''}
          </span>
        </div>
      )}

      {isEditor && mode === 'edit' ? (
        <textarea
          className={styles.bodyTextarea}
          value={bodyMarkdown}
          placeholder={'Markdown + [[ссылки]] и ![[изображения]]…'}
          onChange={event => {
            setBodyMarkdown(event.target.value)
            commit({ bodyMarkdown: event.target.value }, true)
          }}
        />
      ) : (
        <JournalWikiBody
          client={client}
          source={bodyMarkdown}
          pages={pages}
          images={images}
          onOpenPage={onOpenWikiLink}
        />
      )}

      <JournalImageGallery
        client={client}
        pageId={page.id}
        isEditor={isEditor}
        onInsertEmbed={name => {
          const snippet = bodyMarkdown.trim().length === 0 ? `![[${name}]]` : `\n\n![[${name}]]`
          const next = `${bodyMarkdown}${snippet}`
          setBodyMarkdown(next)
          setMode('edit')
          commit({ bodyMarkdown: next }, false)
        }}
        onChanged={onImagesChanged}
      />
    </div>
  )
}
