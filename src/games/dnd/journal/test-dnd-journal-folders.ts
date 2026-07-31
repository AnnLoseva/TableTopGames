import assert from 'node:assert/strict'
import { buildFolderTree, canNestFolder, folderBreadcrumb } from './folder-tree'
import type { DndJournalFolder, DndJournalPage } from './types'

const folders: DndJournalFolder[] = [
  { id: 'a', sectionId: 'main', parentFolderId: null, name: 'Кампания', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'b', sectionId: 'main', parentFolderId: 'a', name: 'Арки', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'c', sectionId: 'main', parentFolderId: 'b', name: 'Первая арка', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'other', sectionId: 'location', parentFolderId: null, name: 'Города', sortOrder: 0, createdAt: '', updatedAt: '' },
]

const page = (id: string, folderId: string | null): DndJournalPage => ({
  id,
  title: id,
  bodyMarkdown: '',
  type: 'note',
  aliases: [],
  isFavorite: false,
  isPinned: false,
  isArchived: false,
  folderId,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
})

const tree = buildFolderTree(folders, [page('one', 'a'), page('two', 'b')], 'main')
assert.equal(tree.length, 1)
assert.equal(tree[0]?.pageCount, 1)
assert.equal(tree[0]?.children[0]?.pageCount, 1)
assert.equal(folderBreadcrumb('c', folders), 'Кампания / Арки / Первая арка')
assert.equal(canNestFolder('a', 'c', folders), false, 'a folder cannot move into its descendant')
assert.equal(canNestFolder('other', 'c', folders), false, 'the fourth nesting level is rejected')

console.log('D&D journal folder tests passed')
