'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from '@/platform/account/AccountProvider'
import { createAccountClient } from '@/platform/account/supabase'
import {
  createJournalFolder,
  listJournalFolders,
  renameJournalFolder,
  softDeleteJournalFolder,
} from './api/folders-api'
import { listAllJournalImages } from './api/images-api'
import { createJournalPage, listJournalPages, softDeleteJournalPage, updateJournalPage } from './api/journal-api'
import styles from './components/DndJournalRoute.module.css'
import JournalEditor from './components/JournalEditor'
import JournalPageList from './components/JournalPageList'
import JournalSidebar from './components/JournalSidebar'
import { findPageByWikiTitle } from './wiki-markup'
import {
  DND_JOURNAL_FOLDERS_TABLE,
  DND_JOURNAL_MAX_FOLDER_DEPTH,
  DND_JOURNAL_OWNER_AUTH_USER_ID,
  DND_JOURNAL_PAGES_TABLE,
  DND_PAGE_CATEGORY_BY_TYPE,
  DND_PAGE_TYPE_LABELS,
  DND_PAGE_TYPES,
} from './constants'
import { folderDepth } from './folder-tree'
import { mapFolderRow, mapPageRow } from './mappers'
import type {
  DndJournalCategory,
  DndJournalFolder,
  DndJournalFolderRow,
  DndJournalImage,
  DndJournalPage,
  DndJournalPageEditablePatch,
  DndJournalPageRow,
  DndJournalScope,
  DndPageType,
} from './types'

function mergeRealtimePage(pages: DndJournalPage[], row: DndJournalPageRow): DndJournalPage[] {
  if (row.deleted_at) return pages.filter(page => page.id !== row.id)
  const mapped = mapPageRow(row)
  return pages.some(page => page.id === row.id)
    ? pages.map(page => (page.id === row.id ? mapped : page))
    : [mapped, ...pages]
}

function mergeRealtimeFolder(folders: DndJournalFolder[], row: DndJournalFolderRow): DndJournalFolder[] {
  if (row.deleted_at) return folders.filter(folder => folder.id !== row.id)
  const mapped = mapFolderRow(row)
  return folders.some(folder => folder.id === row.id)
    ? folders.map(folder => (folder.id === row.id ? mapped : folder))
    : [...folders, mapped]
}

function defaultTypeForCategory(category: DndJournalCategory): DndPageType {
  if (category === 'session') return 'session'
  if (category === 'character') return 'character'
  if (category === 'location') return 'location'
  if (category === 'organization') return 'organization'
  if (category === 'chronology') return 'event'
  if (category === 'quest') return 'quest'
  if (category === 'item') return 'item'
  if (category === 'images') return 'image'
  if (category === 'bestiary') return 'bestiary'
  return 'note'
}

function templateFor(type: DndPageType): string {
  if (type === 'character') {
    return '**Раса:**\n\n**Класс:**\n\n## Предыстория\n\n\n\n## Мотивация\n\n\n\n## Описание\n\n\n\n## События\n\n\n\n## Изображение\n'
  }
  if (type === 'bestiary') {
    return '**Тип существа:**\n\n**Размер существа:**\n\n## Слабые стороны\n\n\n\n## Сильные стороны\n\n\n\n## Способности\n\n\n\n## Описание\n\n\n\n## Изображение\n'
  }
  return ''
}

export default function DndJournalRoute() {
  const { account, isReady } = useAccount()
  const client = useMemo(() => createAccountClient(), [])
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [pages, setPages] = useState<DndJournalPage[]>([])
  const [folders, setFolders] = useState<DndJournalFolder[]>([])
  const [images, setImages] = useState<DndJournalImage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scope, setScope] = useState<DndJournalScope>({ kind: 'category', category: 'main' })
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [query, setQuery] = useState('')
  const [navVisible, setNavVisible] = useState(true)
  const [listVisible, setListVisible] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [newPageTitle, setNewPageTitle] = useState('')
  const [newPageType, setNewPageType] = useState<DndPageType>('note')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!account) {
      setAuthUserId(null)
      return
    }
    let cancelled = false
    client.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthUserId(data.user?.id ?? null)
    })
    return () => { cancelled = true }
  }, [account, client])

  useEffect(() => {
    if (window.innerWidth < 980) setNavVisible(false)
    if (window.innerWidth < 720) setListVisible(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    Promise.all([
      listJournalPages(client),
      listJournalFolders(client),
      listAllJournalImages(client).catch(error => {
        console.error('Не удалось загрузить изображения журнала:', error)
        return [] as DndJournalImage[]
      }),
    ])
      .then(([loadedPages, loadedFolders, loadedImages]) => {
        if (cancelled) return
        setPages(loadedPages)
        setFolders(loadedFolders)
        setImages(loadedImages)
        const first = loadedPages.find(page => !page.isArchived) ?? loadedPages[0]
        if (first) {
          setSelectedId(first.id)
          setScope(first.isArchived
            ? { kind: 'archived' }
            : { kind: 'category', category: DND_PAGE_CATEGORY_BY_TYPE[first.type] })
          setSelectedFolderId(first.isArchived ? null : first.folderId)
          setHistory([first.id])
          setHistoryIndex(0)
        }
      })
      .catch(error => {
        if (cancelled) return
        console.error('Не удалось загрузить журнал:', error)
        setLoadError('Не удалось загрузить журнал. Попробуйте обновить страницу.')
      })
    return () => { cancelled = true }
  }, [client])

  const isEditor = authUserId === DND_JOURNAL_OWNER_AUTH_USER_ID

  useEffect(() => {
    const pageChannel = client
      .channel('dnd-journal-pages')
      .on('postgres_changes', { event: '*', schema: 'public', table: DND_JOURNAL_PAGES_TABLE }, payload => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string } | null)?.id
          if (oldId) setPages(previous => previous.filter(page => page.id !== oldId))
          return
        }
        setPages(previous => mergeRealtimePage(previous, payload.new as DndJournalPageRow))
      })
      .subscribe()
    const folderChannel = client
      .channel('dnd-journal-folders')
      .on('postgres_changes', { event: '*', schema: 'public', table: DND_JOURNAL_FOLDERS_TABLE }, payload => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string } | null)?.id
          if (oldId) setFolders(previous => previous.filter(folder => folder.id !== oldId))
          return
        }
        setFolders(previous => mergeRealtimeFolder(previous, payload.new as DndJournalFolderRow))
      })
      .subscribe()
    return () => {
      void client.removeChannel(pageChannel)
      void client.removeChannel(folderChannel)
    }
  }, [client])

  const revealPage = (page: DndJournalPage) => {
    setSelectedId(page.id)
    setRecentIds(previous => [page.id, ...previous.filter(id => id !== page.id)].slice(0, 30))
    if (page.isArchived) {
      setScope({ kind: 'archived' })
      setSelectedFolderId(null)
    } else {
      setScope({ kind: 'category', category: DND_PAGE_CATEGORY_BY_TYPE[page.type] })
      setSelectedFolderId(page.folderId)
    }
  }

  const handleSelectPage = (id: string) => {
    const page = pages.find(item => item.id === id)
    if (!page) return
    revealPage(page)
    setHistory(previous => {
      const next = previous.slice(0, historyIndex + 1)
      if (next.at(-1) !== id) next.push(id)
      setHistoryIndex(next.length - 1)
      return next
    })
  }

  /** Wiki `[[Title]]` from the reading view — open or offer to create. */
  const handleOpenWikiLink = (title: string) => {
    const existing = findPageByWikiTitle(pages, title)
    if (existing) {
      handleSelectPage(existing.id)
      return
    }
    if (!isEditor) {
      setLoadError(`Страница «${title}» ещё не создана.`)
      return
    }
    setNewPageTitle(title)
    setNewPageType(scope.kind === 'category' ? defaultTypeForCategory(scope.category) : 'note')
    setNewPageOpen(true)
  }

  const goHistory = (nextIndex: number) => {
    const id = history[nextIndex]
    const page = pages.find(item => item.id === id)
    if (!page) return
    setHistoryIndex(nextIndex)
    revealPage(page)
  }

  const handleSelectScope = (nextScope: DndJournalScope, folderId: string | null) => {
    setScope(nextScope)
    setSelectedFolderId(folderId)
    if (!listVisible) setListVisible(true)
  }

  const openNewPage = () => {
    const type = scope.kind === 'category' ? defaultTypeForCategory(scope.category) : 'note'
    setNewPageTitle('')
    setNewPageType(type)
    setNewPageOpen(true)
  }

  const handleCreate = async () => {
    const title = newPageTitle.trim()
    if (!title) return
    setIsCreating(true)
    try {
      const category = DND_PAGE_CATEGORY_BY_TYPE[newPageType]
      const folderId = scope.kind === 'category' && scope.category === category ? selectedFolderId : null
      const created = await createJournalPage(client, {
        title,
        type: newPageType,
        bodyMarkdown: templateFor(newPageType),
        folderId,
      })
      setPages(previous => [created, ...previous])
      setNewPageOpen(false)
      revealPage(created)
      setHistory(previous => {
        const next = previous.slice(0, historyIndex + 1)
        if (next.at(-1) !== created.id) next.push(created.id)
        setHistoryIndex(next.length - 1)
        return next
      })
    } catch (error) {
      console.error('Не удалось создать страницу журнала:', error)
      setLoadError('Не удалось создать страницу.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async (
    id: string,
    patch: DndJournalPageEditablePatch,
    baselineBodyMarkdown?: string,
  ): Promise<DndJournalPage> => {
    const updated = await updateJournalPage(client, id, patch, { baselineBodyMarkdown })
    setPages(previous => previous.map(page => (page.id === id ? updated : page)))
    if (id === selectedId && patch.isArchived !== undefined) revealPage(updated)
    return updated
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить страницу журнала?')) return
    try {
      await softDeleteJournalPage(client, id)
      setPages(previous => previous.filter(page => page.id !== id))
      setSelectedId(previous => (previous === id ? null : previous))
    } catch (error) {
      console.error('Не удалось удалить страницу журнала:', error)
      setLoadError('Не удалось удалить страницу.')
    }
  }

  const handleCreateFolder = async (sectionId: DndJournalCategory, parentFolderId: string | null) => {
    if (folderDepth(parentFolderId, folders) >= DND_JOURNAL_MAX_FOLDER_DEPTH) {
      window.alert(`Нельзя создать папку глубже ${DND_JOURNAL_MAX_FOLDER_DEPTH} уровней.`)
      return
    }
    const name = window.prompt('Название новой папки:')?.trim()
    if (!name) return
    try {
      const siblings = folders.filter(folder => folder.sectionId === sectionId && folder.parentFolderId === parentFolderId)
      const created = await createJournalFolder(client, {
        sectionId,
        parentFolderId,
        name,
        sortOrder: Math.max(-1, ...siblings.map(folder => folder.sortOrder)) + 1,
      })
      setFolders(previous => [...previous, created])
      handleSelectScope({ kind: 'category', category: sectionId }, created.id)
    } catch (error) {
      console.error('Не удалось создать папку:', error)
      setLoadError('Не удалось создать папку.')
    }
  }

  const handleRenameFolder = async (folder: DndJournalFolder) => {
    const name = window.prompt('Новое название папки:', folder.name)?.trim()
    if (!name || name === folder.name) return
    try {
      const updated = await renameJournalFolder(client, folder.id, name)
      setFolders(previous => previous.map(item => (item.id === folder.id ? updated : item)))
    } catch (error) {
      console.error('Не удалось переименовать папку:', error)
      setLoadError('Не удалось переименовать папку.')
    }
  }

  const handleDeleteFolder = async (folder: DndJournalFolder) => {
    if (!window.confirm(`Удалить папку «${folder.name}»? Страницы и вложенные папки останутся в корне раздела.`)) return
    try {
      await softDeleteJournalFolder(client, folder.id)
      setPages(previous => previous.map(page => page.folderId === folder.id ? { ...page, folderId: null } : page))
      setFolders(previous => previous
        .filter(item => item.id !== folder.id)
        .map(item => item.parentFolderId === folder.id ? { ...item, parentFolderId: null } : item))
      if (selectedFolderId === folder.id) setSelectedFolderId(null)
    } catch (error) {
      console.error('Не удалось удалить папку:', error)
      setLoadError('Не удалось удалить папку.')
    }
  }

  const selectedPage = pages.find(page => page.id === selectedId) ?? null
  const bodyClassName = [
    styles.body,
    !navVisible ? styles.bodyNavHidden : '',
    !listVisible ? styles.bodyListHidden : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.historyButtons}>
          <button type="button" onClick={() => setNavVisible(value => !value)} aria-label={navVisible ? 'Скрыть разделы' : 'Показать разделы'}>☰</button>
          <button type="button" onClick={() => goHistory(historyIndex - 1)} disabled={historyIndex <= 0} aria-label="Назад">←</button>
          <button type="button" onClick={() => goHistory(historyIndex + 1)} disabled={historyIndex >= history.length - 1} aria-label="Вперёд">→</button>
        </div>
        <Link href="/" className={styles.brandLink}>Rena · Журнал</Link>
        <label className={styles.globalSearch}>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти страницу, персонажа, место…" />
          <kbd>⌘K</kbd>
        </label>
        <span className={styles.account}>
          {isEditor ? 'Режим редактирования' : !isReady ? 'Проверяю аккаунт…' : account ? `Аккаунт: ${account.username}` : 'Гостевой режим'}
        </span>
        <button type="button" className={styles.topBarButton} onClick={() => setListVisible(value => !value)}>
          {listVisible ? 'Скрыть список' : 'Страницы'}
        </button>
        {isEditor && <button type="button" className={styles.topBarCreate} onClick={openNewPage}>+</button>}
      </header>

      <div className={bodyClassName}>
        {navVisible && (
          <JournalSidebar
            pages={pages}
            folders={folders}
            scope={scope}
            selectedFolderId={selectedFolderId}
            onSelectScope={handleSelectScope}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onCollapse={() => setNavVisible(false)}
            isEditor={isEditor}
          />
        )}
        {listVisible && (
          <JournalPageList
            pages={pages}
            folders={folders}
            scope={scope}
            selectedFolderId={selectedFolderId}
            recentIds={recentIds}
            selectedId={selectedId}
            query={query}
            onQueryChange={setQuery}
            onSelect={handleSelectPage}
            onCreate={openNewPage}
            onCollapse={() => setListVisible(false)}
            isCreating={isCreating}
            isEditor={isEditor}
          />
        )}
        <main className={styles.main}>
          {loadError && <p className={styles.routeError}>{loadError}</p>}
          {selectedPage ? (
            <JournalEditor
              key={selectedPage.id}
              client={client}
              page={selectedPage}
              pages={pages}
              images={images}
              folders={folders}
              onSave={handleSave}
              onDelete={handleDelete}
              onOpenWikiLink={handleOpenWikiLink}
              isEditor={isEditor}
            />
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderSigil}>Г</span>
              <p>{pages.length === 0 ? 'В журнале пока нет страниц.' : 'Выберите страницу из списка или создайте новую.'}</p>
            </div>
          )}
        </main>
      </div>

      {newPageOpen && (
        <div className={styles.modalScrim} role="presentation" onMouseDown={() => setNewPageOpen(false)}>
          <form
            className={styles.newPageDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-page-title"
            onMouseDown={event => event.stopPropagation()}
            onSubmit={event => { event.preventDefault(); void handleCreate() }}
          >
            <h2 id="new-page-title">Новая страница</h2>
            <label>
              Название
              <input autoFocus value={newPageTitle} onChange={event => setNewPageTitle(event.target.value)} placeholder="Название страницы" />
            </label>
            <label>
              Тип
              <select value={newPageType} onChange={event => setNewPageType(event.target.value as DndPageType)}>
                {DND_PAGE_TYPES.map(type => <option key={type} value={type}>{DND_PAGE_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setNewPageOpen(false)}>Отмена</button>
              <button type="submit" className={styles.primaryButton} disabled={!newPageTitle.trim() || isCreating}>Создать</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
