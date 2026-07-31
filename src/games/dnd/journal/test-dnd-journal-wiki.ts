import assert from 'node:assert/strict'
import {
  decodeWikiHref,
  extractWikiPageTitles,
  findImageByName,
  findPageByWikiTitle,
  standaloneImageName,
  tokenizeInline,
  wikiToMarkdown,
} from './wiki-markup'
import type { DndJournalImage, DndJournalPage } from './types'

const page = (title: string, aliases: string[] = []): DndJournalPage => ({
  id: title,
  title,
  bodyMarkdown: '',
  type: 'note',
  aliases,
  isFavorite: false,
  isPinned: false,
  isArchived: false,
  folderId: null,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
})

const image = (name: string): DndJournalImage => ({
  id: name,
  pageId: null,
  name,
  storagePath: `u/${name}`,
  createdAt: '',
})

// Page lookup by title and alias
const pages = [page('Курасановка', ['Kurasanovka']), page('Гриннест')]
assert.equal(findPageByWikiTitle(pages, 'курасановка')?.id, 'Курасановка')
assert.equal(findPageByWikiTitle(pages, 'Kurasanovka')?.id, 'Курасановка')
assert.equal(findPageByWikiTitle(pages, 'нет такой'), undefined)

// Image lookup
const images = [image('карта.png'), image('Портрет')]
assert.equal(findImageByName(images, 'КАРТА.PNG')?.name, 'карта.png')
assert.equal(findImageByName(images, 'missing'), undefined)

// Standalone image line
assert.equal(standaloneImageName('  ![[карта.png]]  '), 'карта.png')
assert.equal(standaloneImageName('текст ![[карта.png]]'), null)

// Inline tokens
const tokens = tokenizeInline('См. [[Курасановка]] и ![[карта.png]] здесь.')
assert.deepEqual(tokens.map(t => t.kind), ['text', 'page', 'text', 'image', 'text'])
assert.equal(tokens[1]?.kind === 'page' ? tokens[1].title : '', 'Курасановка')
assert.equal(tokens[3]?.kind === 'image' ? tokens[3].name : '', 'карта.png')

// Markdown conversion preserves GFM and rewrites wiki forms
const md = wikiToMarkdown('## Заголовок\n\nСсылка на [[Гриннест]] и ![[Портрет]] в строке.\n\n![[карта.png]]\n')
assert.match(md, /\[Гриннест\]\(dnd-page:/)
assert.match(md, /!\[Портрет\]\(dnd-image:/)
assert.match(md, /^!\[\[карта\.png\]\]$/m)

// Href decode
assert.equal(decodeWikiHref('dnd-page:%D0%93%D1%80%D0%B8%D0%BD%D0%BD%D0%B5%D1%81%D1%82', 'dnd-page'), 'Гриннест')
assert.equal(decodeWikiHref('https://example.com', 'dnd-page'), null)

// Title extraction ignores image embeds
assert.deepEqual(
  extractWikiPageTitles('[[A]] и ![[pic]] плюс [[B]]'),
  ['A', 'B'],
)

console.log('D&D journal wiki tests passed')
