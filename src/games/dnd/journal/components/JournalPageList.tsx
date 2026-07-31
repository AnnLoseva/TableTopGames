'use client'

import { useMemo, useState } from 'react'
import {
  DND_JOURNAL_CATEGORY_LABELS,
  DND_JOURNAL_CATEGORY_SIGILS,
  DND_PAGE_CATEGORY_BY_TYPE,
  DND_PAGE_TYPE_LABELS,
} from '../constants'
import { folderBreadcrumb } from '../folder-tree'
import type { DndJournalFolder, DndJournalPage, DndJournalScope } from '../types'
import styles from './DndJournalRoute.module.css'

type JournalPageListProps = {
  pages: DndJournalPage[]
  folders: DndJournalFolder[]
  scope: DndJournalScope
  selectedFolderId: string | null
  recentIds: string[]
  selectedId: string | null
  query: string
  onQueryChange: (query: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onCollapse: () => void
  isCreating: boolean
  isEditor: boolean
}

type SortMode = 'updated' | 'title' | 'created' | 'manual'

const SORT_LABELS: Record<SortMode, string> = {
  updated: 'по дате',
  title: 'по имени',
  created: 'по созданию',
  manual: 'вручную',
}

const SORT_ORDER: SortMode[] = ['updated', 'title', 'created', 'manual']

function listTitle(scope: DndJournalScope) {
  if (scope.kind === 'category') return DND_JOURNAL_CATEGORY_LABELS[scope.category]
  if (scope.kind === 'favorites') return 'Избранное'
  if (scope.kind === 'recent') return 'Недавние'
  return 'Архив'
}

function listSigil(scope: DndJournalScope) {
  if (scope.kind === 'category') return DND_JOURNAL_CATEGORY_SIGILS[scope.category]
  if (scope.kind === 'favorites') return '✦'
  if (scope.kind === 'recent') return '↺'
  return 'А'
}

function snippet(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/[#>*_`~\-[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function pageSigil(page: DndJournalPage) {
  return DND_JOURNAL_CATEGORY_SIGILS[DND_PAGE_CATEGORY_BY_TYPE[page.type]]
}

export default function JournalPageList({
  pages,
  folders,
  scope,
  selectedFolderId,
  recentIds,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  onCollapse,
  isCreating,
  isEditor,
}: JournalPageListProps) {
  const [sort, setSort] = useState<SortMode>('updated')

  const listedPages = useMemo(() => {
    let result: DndJournalPage[]
    let keepOrder = false
    if (scope.kind === 'category') {
      result = pages.filter(page => !page.isArchived && DND_PAGE_CATEGORY_BY_TYPE[page.type] === scope.category)
      if (selectedFolderId) result = result.filter(page => page.folderId === selectedFolderId)
    } else if (scope.kind === 'favorites') {
      result = pages.filter(page => !page.isArchived && page.isFavorite)
    } else if (scope.kind === 'archived') {
      result = pages.filter(page => page.isArchived)
    } else {
      const lookup = new Map(pages.map(page => [page.id, page]))
      result = recentIds.flatMap(id => {
        const page = lookup.get(id)
        return page && !page.isArchived ? [page] : []
      })
      keepOrder = true
    }

    const needle = query.trim().toLocaleLowerCase('ru')
    if (needle) {
      result = result.filter(page => [page.title, page.bodyMarkdown, ...page.aliases]
        .some(value => value.toLocaleLowerCase('ru').includes(needle)))
    }

    if (!keepOrder) {
      result = [...result].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        if (sort === 'title') return a.title.localeCompare(b.title, 'ru')
        if (sort === 'created') return b.createdAt.localeCompare(a.createdAt)
        if (sort === 'manual') return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ru')
        return b.updatedAt.localeCompare(a.updatedAt)
      })
    }
    return result
  }, [pages, query, recentIds, scope, selectedFolderId, sort])

  const cycleSort = () => setSort(current => SORT_ORDER[(SORT_ORDER.indexOf(current) + 1) % SORT_ORDER.length] ?? 'updated')
  const context = scope.kind === 'category' && selectedFolderId ? folderBreadcrumb(selectedFolderId, folders) : null

  return (
    <aside className={styles.pageListPanel} aria-label="Страницы журнала">
      <div className={styles.panelHeading}>
        <span>{listTitle(scope)}</span>
        <button type="button" className={styles.collapseButton} onClick={onCollapse} aria-label="Скрыть список страниц">‹</button>
      </div>
      {context && <p className={styles.listContext}>{context}</p>}
      <div className={styles.listControls}>
        <input className={styles.searchInput} placeholder="Фильтр…" value={query} onChange={event => onQueryChange(event.target.value)} />
        <button type="button" className={styles.sortButton} onClick={cycleSort}>{SORT_LABELS[sort]}</button>
      </div>
      {isEditor && (
        <button type="button" className={styles.newPageButton} onClick={onCreate} disabled={isCreating}>
          {isCreating ? 'Создаю…' : '+ Новая страница'}
        </button>
      )}
      <div className={styles.pageRows}>
        {listedPages.length === 0 ? (
          <div className={styles.emptyList}>
            <span className={styles.emptySigil}>{listSigil(scope)}</span>
            <p>{query ? 'Ничего не найдено.' : 'В этом разделе пока нет страниц.'}</p>
          </div>
        ) : listedPages.map(page => (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelect(page.id)}
            className={`${styles.pageRow} ${page.id === selectedId ? styles.pageRowActive : ''}`}
          >
            <span className={styles.pageSigil}>{pageSigil(page)}</span>
            <span className={styles.pageRowContent}>
              <span className={styles.pageRowHeading}>
                <strong>{page.title || 'Без названия'}</strong>
                {(page.isPinned || page.isFavorite) && <span>{page.isPinned ? '✦' : '✧'}</span>}
              </span>
              {page.folderId && <span className={styles.pageFolder}>{folderBreadcrumb(page.folderId, folders)}</span>}
              {snippet(page.bodyMarkdown) && <span className={styles.pageSnippet}>{snippet(page.bodyMarkdown)}</span>}
              <span className={styles.pageDate}>
                {DND_PAGE_TYPE_LABELS[page.type]} · {new Date(page.updatedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
