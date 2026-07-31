import { DND_JOURNAL_MAX_FOLDER_DEPTH } from './constants'
import type { DndJournalCategory, DndJournalFolder, DndJournalPage } from './types'

export type DndJournalFolderNode = {
  folder: DndJournalFolder
  children: DndJournalFolderNode[]
  pageCount: number
}

function compareFolders(a: DndJournalFolder, b: DndJournalFolder): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru')
}

export function buildFolderTree(
  folders: DndJournalFolder[],
  pages: DndJournalPage[],
  sectionId: DndJournalCategory,
): DndJournalFolderNode[] {
  const sectionFolders = folders.filter(folder => folder.sectionId === sectionId)
  const byParent = new Map<string | null, DndJournalFolder[]>()
  for (const folder of sectionFolders) {
    const siblings = byParent.get(folder.parentFolderId) ?? []
    siblings.push(folder)
    byParent.set(folder.parentFolderId, siblings)
  }
  for (const siblings of byParent.values()) siblings.sort(compareFolders)

  const visit = (parentId: string | null, depth: number, ancestors: Set<string>): DndJournalFolderNode[] => {
    if (depth > DND_JOURNAL_MAX_FOLDER_DEPTH) return []
    return (byParent.get(parentId) ?? []).flatMap(folder => {
      if (ancestors.has(folder.id)) return []
      const nextAncestors = new Set(ancestors)
      nextAncestors.add(folder.id)
      return [{
        folder,
        children: visit(folder.id, depth + 1, nextAncestors),
        pageCount: pages.filter(page => !page.isArchived && page.folderId === folder.id).length,
      }]
    })
  }

  return visit(null, 1, new Set())
}

export function folderPath(folderId: string, folders: DndJournalFolder[]): DndJournalFolder[] {
  const lookup = new Map(folders.map(folder => [folder.id, folder]))
  const result: DndJournalFolder[] = []
  const visited = new Set<string>()
  let currentId: string | null = folderId
  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const folder = lookup.get(currentId)
    if (!folder) break
    result.push(folder)
    currentId = folder.parentFolderId
  }
  return result.reverse()
}

export function folderDepth(folderId: string | null, folders: DndJournalFolder[]): number {
  if (!folderId) return 0
  return folderPath(folderId, folders).length
}

export function canNestFolder(
  folderId: string,
  parentFolderId: string | null,
  folders: DndJournalFolder[],
): boolean {
  if (folderId === parentFolderId) return false
  if (parentFolderId && folderPath(parentFolderId, folders).some(folder => folder.id === folderId)) return false
  return folderDepth(parentFolderId, folders) < DND_JOURNAL_MAX_FOLDER_DEPTH
}

export function folderBreadcrumb(folderId: string | null, folders: DndJournalFolder[]): string {
  if (!folderId) return 'Все записи'
  return folderPath(folderId, folders).map(folder => folder.name).join(' / ')
}
