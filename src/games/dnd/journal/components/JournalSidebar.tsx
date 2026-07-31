'use client'

import { useMemo, useState } from 'react'
import {
  DND_JOURNAL_CATEGORY_LABELS,
  DND_JOURNAL_CATEGORY_ORDER,
  DND_PAGE_CATEGORY_BY_TYPE,
  DND_PAGE_TYPE_LABELS,
} from '../constants'
import type { DndJournalCategory, DndJournalPage } from '../types'
import styles from './DndJournalRoute.module.css'

type JournalSidebarProps = {
  pages: DndJournalPage[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  isCreating: boolean
  isEditor: boolean
}

function pageSigil(title: string, typeLabel: string) {
  const source = title.trim() || typeLabel
  return source.slice(0, 1).toUpperCase()
}

export default function JournalSidebar({ pages, selectedId, onSelect, onCreate, isCreating, isEditor }: JournalSidebarProps) {
  const [search, setSearch] = useState('')

  const visiblePages = useMemo(() => {
    const activePages = pages.filter(page => !page.isArchived)
    const query = search.trim().toLowerCase()
    const filtered = query
      ? activePages.filter(page =>
        page.title.toLowerCase().includes(query)
        || page.aliases.some(alias => alias.toLowerCase().includes(query)))
      : activePages
    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [pages, search])

  const grouped = useMemo(() => {
    const byCategory = new Map<DndJournalCategory, DndJournalPage[]>()
    for (const page of visiblePages) {
      const category = DND_PAGE_CATEGORY_BY_TYPE[page.type]
      const list = byCategory.get(category) ?? []
      list.push(page)
      byCategory.set(category, list)
    }
    return byCategory
  }, [visiblePages])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <input
          className={styles.searchInput}
          placeholder="Поиск по журналу…"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        {isEditor && (
          <button type="button" className={styles.newPageButton} onClick={onCreate} disabled={isCreating}>
            {isCreating ? 'Создаю…' : '+ Новая страница'}
          </button>
        )}
      </div>
      <nav className={styles.categories}>
        {visiblePages.length === 0 && (
          <p className={styles.emptyList}>
            {search ? 'Ничего не найдено.' : 'Журнал пуст. Создайте первую страницу.'}
          </p>
        )}
        {DND_JOURNAL_CATEGORY_ORDER.filter(category => grouped.has(category)).map(category => (
          <div key={category}>
            <p className={styles.categoryLabel}>{DND_JOURNAL_CATEGORY_LABELS[category]}</p>
            {(grouped.get(category) ?? []).map(page => (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelect(page.id)}
                className={`${styles.pageRow} ${page.id === selectedId ? styles.pageRowActive : ''}`}
              >
                <span className={styles.pageSigil}>{pageSigil(page.title, DND_PAGE_TYPE_LABELS[page.type])}</span>
                <span className={styles.pageRowTitle}>{page.title || 'Без названия'}</span>
                {page.isPinned && <span className={styles.pinDot} aria-hidden="true" />}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
