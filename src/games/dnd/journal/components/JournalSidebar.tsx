'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DND_JOURNAL_CATEGORY_LABELS,
  DND_JOURNAL_CATEGORY_ORDER,
  DND_JOURNAL_CATEGORY_SIGILS,
  DND_PAGE_CATEGORY_BY_TYPE,
} from '../constants'
import { buildFolderTree, folderPath, type DndJournalFolderNode } from '../folder-tree'
import type { DndJournalCategory, DndJournalFolder, DndJournalPage, DndJournalScope } from '../types'
import styles from './DndJournalRoute.module.css'

type JournalSidebarProps = {
  pages: DndJournalPage[]
  folders: DndJournalFolder[]
  scope: DndJournalScope
  selectedFolderId: string | null
  onSelectScope: (scope: DndJournalScope, folderId: string | null) => void
  onCreateFolder: (sectionId: DndJournalCategory, parentFolderId: string | null) => void
  onRenameFolder: (folder: DndJournalFolder) => void
  onDeleteFolder: (folder: DndJournalFolder) => void
  onCollapse: () => void
  isEditor: boolean
}

type FolderRowProps = {
  node: DndJournalFolderNode
  depth: number
  selectedFolderId: string | null
  expandedFolderIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onCreateFolder: (parentId: string) => void
  onRenameFolder: (folder: DndJournalFolder) => void
  onDeleteFolder: (folder: DndJournalFolder) => void
  isEditor: boolean
}

function FolderRow({
  node,
  depth,
  selectedFolderId,
  expandedFolderIds,
  onToggle,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  isEditor,
}: FolderRowProps) {
  const expanded = expandedFolderIds.has(node.folder.id)
  const selected = selectedFolderId === node.folder.id
  return (
    <div>
      <div className={`${styles.folderRow} ${selected ? styles.folderRowActive : ''}`} style={{ paddingLeft: `${8 + depth * 14}px` }}>
        {node.children.length > 0 ? (
          <button
            type="button"
            className={`${styles.disclosureButton} ${expanded ? styles.disclosureButtonOpen : ''}`}
            onClick={() => onToggle(node.folder.id)}
            aria-label={expanded ? `Свернуть папку ${node.folder.name}` : `Развернуть папку ${node.folder.name}`}
          >
            ›
          </button>
        ) : <span className={styles.disclosureSpacer} />}
        <button type="button" className={styles.folderSelectButton} onClick={() => onSelect(node.folder.id)}>
          <span className={styles.folderGlyph} aria-hidden="true">◆</span>
          <span className={styles.folderName}>{node.folder.name}</span>
          <span className={styles.rowCount}>{node.pageCount}</span>
        </button>
        {isEditor && (
          <span className={styles.folderActions}>
            <button type="button" onClick={() => onCreateFolder(node.folder.id)} title="Создать вложенную папку">+</button>
            <button type="button" onClick={() => onRenameFolder(node.folder)} title="Переименовать папку">✎</button>
            <button type="button" onClick={() => onDeleteFolder(node.folder)} title="Удалить папку">×</button>
          </span>
        )}
      </div>
      {expanded && node.children.map(child => (
        <FolderRow
          key={child.folder.id}
          node={child}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          expandedFolderIds={expandedFolderIds}
          onToggle={onToggle}
          onSelect={onSelect}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          isEditor={isEditor}
        />
      ))}
    </div>
  )
}

function sameShelf(scope: DndJournalScope, kind: 'favorites' | 'recent' | 'archived') {
  return scope.kind === kind
}

export default function JournalSidebar({
  pages,
  folders,
  scope,
  selectedFolderId,
  onSelectScope,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCollapse,
  isEditor,
}: JournalSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<DndJournalCategory>>(() => new Set(['main']))
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (scope.kind !== 'category') return
    setExpandedCategories(previous => new Set(previous).add(scope.category))
    if (!selectedFolderId) return
    setExpandedFolderIds(previous => {
      const next = new Set(previous)
      for (const folder of folderPath(selectedFolderId, folders)) next.add(folder.id)
      return next
    })
  }, [folders, scope, selectedFolderId])

  const trees = useMemo(() => new Map(
    DND_JOURNAL_CATEGORY_ORDER.map(category => [category, buildFolderTree(folders, pages, category)]),
  ), [folders, pages])

  const toggleCategory = (category: DndJournalCategory) => {
    setExpandedCategories(previous => {
      const next = new Set(previous)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds(previous => {
      const next = new Set(previous)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const categoryCount = (category: DndJournalCategory) => pages.filter(
    page => !page.isArchived && DND_PAGE_CATEGORY_BY_TYPE[page.type] === category,
  ).length
  const rootCount = (category: DndJournalCategory) => pages.filter(
    page => !page.isArchived && page.folderId === null && DND_PAGE_CATEGORY_BY_TYPE[page.type] === category,
  ).length

  return (
    <aside className={styles.sidebar} aria-label="Разделы журнала">
      <div className={styles.panelHeading}>
        <span>Журнал</span>
        <button type="button" className={styles.collapseButton} onClick={onCollapse} aria-label="Скрыть разделы">‹</button>
      </div>
      <nav className={styles.categories}>
        {DND_JOURNAL_CATEGORY_ORDER.map(category => {
          const expanded = expandedCategories.has(category)
          const categorySelected = scope.kind === 'category' && scope.category === category && selectedFolderId === null
          return (
            <div key={category} className={styles.categoryBlock}>
              <div className={styles.categoryRow}>
                <button
                  type="button"
                  className={`${styles.disclosureButton} ${expanded ? styles.disclosureButtonOpen : ''}`}
                  onClick={() => toggleCategory(category)}
                  aria-label={expanded ? `Свернуть раздел ${DND_JOURNAL_CATEGORY_LABELS[category]}` : `Развернуть раздел ${DND_JOURNAL_CATEGORY_LABELS[category]}`}
                >
                  ›
                </button>
                <button type="button" className={styles.categorySelectButton} onClick={() => onSelectScope({ kind: 'category', category }, null)}>
                  <span className={styles.sigil}>{DND_JOURNAL_CATEGORY_SIGILS[category]}</span>
                  <span>{DND_JOURNAL_CATEGORY_LABELS[category]}</span>
                  <span className={styles.rowCount}>{categoryCount(category)}</span>
                </button>
                {isEditor && (
                  <button
                    type="button"
                    className={styles.addFolderButton}
                    onClick={() => onCreateFolder(category, null)}
                    aria-label={`Создать папку в разделе ${DND_JOURNAL_CATEGORY_LABELS[category]}`}
                    title="Новая папка"
                  >
                    +
                  </button>
                )}
              </div>
              {expanded && (
                <div className={styles.folderTree}>
                  <button
                    type="button"
                    className={`${styles.rootFolderRow} ${categorySelected ? styles.folderRowActive : ''}`}
                    onClick={() => onSelectScope({ kind: 'category', category }, null)}
                  >
                    <span className={styles.disclosureSpacer} />
                    <span className={styles.sigilSmall}>{DND_JOURNAL_CATEGORY_SIGILS[category]}</span>
                    <span className={styles.folderName}>Все записи</span>
                    <span className={styles.rowCount}>{rootCount(category)}</span>
                  </button>
                  {(trees.get(category) ?? []).map(node => (
                    <FolderRow
                      key={node.folder.id}
                      node={node}
                      depth={0}
                      selectedFolderId={selectedFolderId}
                      expandedFolderIds={expandedFolderIds}
                      onToggle={toggleFolder}
                      onSelect={folderId => onSelectScope({ kind: 'category', category }, folderId)}
                      onCreateFolder={parentId => onCreateFolder(category, parentId)}
                      onRenameFolder={onRenameFolder}
                      onDeleteFolder={onDeleteFolder}
                      isEditor={isEditor}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className={styles.shelf}>
        <button type="button" className={sameShelf(scope, 'favorites') ? styles.shelfActive : ''} onClick={() => onSelectScope({ kind: 'favorites' }, null)}>
          <span>✦</span><span>Избранное</span>
        </button>
        <button type="button" className={sameShelf(scope, 'recent') ? styles.shelfActive : ''} onClick={() => onSelectScope({ kind: 'recent' }, null)}>
          <span>↺</span><span>Недавние</span>
        </button>
        <button type="button" className={sameShelf(scope, 'archived') ? styles.shelfActive : ''} onClick={() => onSelectScope({ kind: 'archived' }, null)}>
          <span>А</span><span>Архив · {pages.filter(page => page.isArchived).length}</span>
        </button>
      </div>
    </aside>
  )
}
