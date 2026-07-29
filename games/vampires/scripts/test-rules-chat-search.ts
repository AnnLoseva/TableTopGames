/**
 * Focused regression tests for the rules-chat retrieval plan.
 * Run: npm run test:rules-chat
 */
import assert from 'node:assert/strict'
import {
  DEFAULT_RULES_EDITION,
  RULEBOOK_LIBRARY,
  RULES_EDITION_MODES,
  buildBookSearchPlan,
  mergeBookHitLists,
  parseQuery,
  sourceForEditionMode,
  type BookHit,
} from '../modules/rules-chat/engine'
import {
  buildCharacterToolPayload,
  editionFallbackForSearch,
  ensureEditionFallbackWarning,
  mergeChronicleToolHits,
  normalizePreferredEdition,
  selectCharacterRows,
  shouldFlagEditionFallback,
  sourceForEdition,
  type LibrarianCharacterRow,
  type LibrarianChronicleHit,
} from '../supabase/functions/librarian-chat/tools'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.error(`  ✗ ${name}`)
    throw error
  }
}

console.log('rules-chat edition mode contract')

test('the edition mode contract contains exactly V5, V20, and general', () => {
  assert.deepEqual(RULES_EDITION_MODES, ['V5', 'V20', 'general'])
})

test('V5 is the default edition mode', () => {
  assert.equal(DEFAULT_RULES_EDITION, 'V5')
})

test('edition-specific modes map to their rulebook library sources', () => {
  for (const edition of ['V5', 'V20'] as const) {
    const book = RULEBOOK_LIBRARY.find(item => item.edition === edition)
    assert.ok(book)
    assert.equal(sourceForEditionMode(edition), book.source)
  }
})

test('general mode leaves the source unrestricted', () => {
  assert.equal(sourceForEditionMode('general'), null)
})

test('edge edition helpers clamp input and map search sources', () => {
  assert.equal(normalizePreferredEdition('V20'), 'V20')
  assert.equal(normalizePreferredEdition('general'), 'general')
  assert.equal(normalizePreferredEdition(undefined), 'V5')
  assert.equal(normalizePreferredEdition('all'), 'V5')
  assert.equal(sourceForEdition('V5'), 'v5-corebook-ru')
  assert.equal(sourceForEdition('V20'), 'v20-corebook-ru')
  assert.equal(sourceForEdition('all'), null)
})

test('edge fallback flag is set only for successful cross-edition results', () => {
  assert.equal(shouldFlagEditionFallback('V5', 'V20', 1), true)
  assert.equal(shouldFlagEditionFallback('V5', 'V20', 0), false)
  assert.equal(shouldFlagEditionFallback('V5', 'V5', 1), false)
  assert.equal(shouldFlagEditionFallback('V5', 'all', 1), false)
  assert.equal(shouldFlagEditionFallback('general', 'all', 1), false)
})

test('a missing model warning is prefixed for a successful V5 to V20 fallback', () => {
  const fallback = editionFallbackForSearch('V5', 'V20', 2)
  assert.deepEqual(fallback, { preferredEdition: 'V5', searchedEdition: 'V20' })
  assert.equal(
    ensureEditionFallbackWarning('Правило действует один раз за ход.', fallback),
    'В выбранной редакции V5 не найдено; ниже информация из V20.\n\nПравило действует один раз за ход.',
  )
})

test('an explicit model warning is preserved without a duplicate prefix', () => {
  const fallback = editionFallbackForSearch('V5', 'V20', 1)
  const answer = 'В выбранной редакции V5 фрагменты не найдены. Далее использована информация из V20.\n\nОтвет.'
  assert.equal(ensureEditionFallbackWarning(answer, fallback), answer)
})

test('the inverse V20 to V5 fallback receives the matching deterministic warning', () => {
  const fallback = editionFallbackForSearch('V20', 'V5', 1)
  assert.equal(
    ensureEditionFallbackWarning('Ответ.', fallback),
    'В выбранной редакции V20 не найдено; ниже информация из V5.\n\nОтвет.',
  )
})

test('general, primary hits, and empty fallbacks never add an edition warning', () => {
  const answer = 'Ответ без предупреждения.'
  assert.equal(
    ensureEditionFallbackWarning(answer, editionFallbackForSearch('general', 'all', 3)),
    answer,
  )
  assert.equal(
    ensureEditionFallbackWarning(answer, editionFallbackForSearch('V5', 'V5', 3)),
    answer,
  )
  assert.equal(
    ensureEditionFallbackWarning(answer, editionFallbackForSearch('V5', 'V20', 0)),
    answer,
  )
})

console.log('rules-chat query classification')

test('a rule question about my character still searches books', () => {
  const parsed = parseQuery('Мой персонаж не пил 2 ночи кровь. Что произойдет?', null)
  assert.equal(parsed.personal, true)
  assert.equal(parsed.searchBooks, true)
})

test('a plain sheet lookup does not search books', () => {
  const parsed = parseQuery('покажи моего персонажа', null)
  assert.equal(parsed.personal, true)
  assert.equal(parsed.searchBooks, false)
})

test('a possessive trait question still reads the character sheet', () => {
  const parsed = parseQuery('какая у меня сила?', null)
  assert.equal(parsed.personal, true)
  assert.equal(parsed.searchBooks, false)
})

test('a polite dative phrase is not mistaken for a sheet lookup', () => {
  const parsed = parseQuery('расскажи мне про клан Тореадор', null)
  assert.equal(parsed.personal, false)
  assert.equal(parsed.searchBooks, true)
})

test('parseQuery uses the preferred edition unless the question names another one', () => {
  assert.equal(parseQuery('Как работает голод?', null, 'V20').source, 'v20-corebook-ru')
  assert.equal(parseQuery('Как работает голод в V5?', null, 'V20').source, 'v5-corebook-ru')
  assert.equal(parseQuery('Как работает голод?', null, 'general').source, null)
})

console.log('rules-chat character tools')

const characters: LibrarianCharacterRow[] = [
  {
    id: 'bridget',
    name: 'Бриджет МакКейн',
    clan: 'Бруха',
    data: {
      backstory: 'Бриджет работает спасательницей.',
      touchstones: [{
        name: 'Кит Вэсли',
        description: 'Девушка Бриджет. Они начали встречаться и сейчас живут вместе.',
        image: 'data:image/jpeg;base64,do-not-send',
      }],
    },
  },
  {
    id: 'kit',
    name: 'Кит Вэсли',
    clan: null,
    data: {
      backstory: 'Живёт с Бриджет. Они в отношениях два года.',
      touchstones: [],
    },
  },
]

test('a partial first name finds the full character name', () => {
  assert.deepEqual(selectCharacterRows(characters, ['Кит']).map(character => character.id), ['kit'])
})

test('one request containing two names returns both character sheets', () => {
  assert.deepEqual(
    selectCharacterRows(characters, ['Бриджет и Кит']).map(character => character.id),
    ['bridget', 'kit'],
  )
})

test('character tool details preserve relationship evidence and omit images', () => {
  const payload = buildCharacterToolPayload(characters, ['Бриджет', 'Кит'])
  const serialized = JSON.stringify(payload)
  assert.match(serialized, /Девушка Бриджет/)
  assert.match(serialized, /отношениях два года/)
  assert.doesNotMatch(serialized, /base64/)
})

test('empty names return only a lightweight character overview', () => {
  const payload = buildCharacterToolPayload(characters, [])
  const serialized = JSON.stringify(payload)
  assert.match(serialized, /overview/)
  assert.doesNotMatch(serialized, /отношениях два года/)
})

console.log('rules-chat search plan')

test('natural starvation wording expands to V5 and V20 rule terms', () => {
  const plan = buildBookSearchPlan('что будет если не пить кровь 1 ночь?')
  assert.ok(plan.queries.includes('каждый пробуждение испытание крови'))
  assert.ok(plan.queries.includes('голод закат'))
  assert.ok(plan.queries.includes('воздерживаться пища'))
  assert.equal(plan.referenceQuery, 'голод')
})

test('hunger typo is normalized', () => {
  const plan = buildBookSearchPlan('Что происходит каждую ночь с голодомЮ')
  assert.equal(plan.referenceQuery, 'голод')
  assert.ok(plan.queries.includes('испытание крови голод'))
})

test('follow-up inherits topic and edition from the previous user question', () => {
  const plan = buildBookSearchPlan('а если две ночи?', ['Как работает голод в V5?'])
  assert.equal(plan.source, 'v5-corebook-ru')
  assert.ok(plan.queries.includes('голод закат'))
})

test('the UI default and an explicit preferred edition supply the source', () => {
  assert.equal(
    buildBookSearchPlan('Как работает голод?', [], DEFAULT_RULES_EDITION).source,
    'v5-corebook-ru',
  )
  assert.equal(buildBookSearchPlan('Как работает голод?', [], 'V20').source, 'v20-corebook-ru')
})

test('an explicit question hint overrides the preferred edition', () => {
  assert.equal(buildBookSearchPlan('Как работает голод в V20?', [], 'V5').source, 'v20-corebook-ru')
})

test('general mode keeps even a follow-up source unrestricted', () => {
  const plan = buildBookSearchPlan('а если две ночи?', ['Как работает голод в V5?'], 'general')
  assert.equal(plan.source, null)
})

test('follow-up keeps the current UI edition while inheriting the previous topic', () => {
  const plan = buildBookSearchPlan('а если две ночи?', ['Как работает голод в V5?'], 'V20')
  assert.equal(plan.source, 'v20-corebook-ru')
  assert.match(plan.queries.join(' '), /голод/)
})

test('library inventory question does not search an unrelated page', () => {
  const plan = buildBookSearchPlan('А какие материалы у тебя вообще есть?')
  assert.equal(plan.isLibraryQuestion, true)
  assert.deepEqual(plan.queries, [])
  assert.equal(plan.referenceQuery, '')
})

console.log('rules-chat result fusion')

test('a page confirmed by several query variants outranks a single noisy hit', () => {
  const hit = (page: number): BookHit => ({
    source: 'v5-corebook-ru',
    title: 'VTM v5: Книга правил (RU)',
    page,
    rank: 1,
    snippet: `page ${page}`,
  })
  const merged = mergeBookHitLists([
    [hit(4), hit(213)],
    [hit(213), hit(221)],
    [hit(213)],
  ])
  assert.equal(merged[0]?.page, 213)
})

test('chronicle chunks confirmed by several queries are deduplicated and promoted', () => {
  const hit = (document: string, chunk: number): LibrarianChronicleHit => ({
    chronicle_id: 'chronicle',
    chronicle_title: 'Знамение Геенны 1',
    document_title: document,
    section_title: `Сцена ${chunk}`,
    chunk_index: chunk,
    rank: 1,
    snippet: `${document} ${chunk}`,
  })
  const merged = mergeChronicleToolHits([
    [hit('Хроника 1', 3), hit('Хроника 4', 6)],
    [hit('Хроника 4', 6)],
  ])
  assert.equal(merged[0]?.document_title, 'Хроника 4')
  assert.equal(merged[0]?.chunk_index, 6)
  assert.equal(merged.filter(item => item.document_title === 'Хроника 4').length, 1)
})

test('official and personal chronicle chunks remain separate sources', () => {
  const base: LibrarianChronicleHit = {
    chronicle_id: 'chronicle',
    chronicle_title: 'Знамение Геенны 1',
    document_title: 'Сессия 4',
    section_title: 'Сцена 1',
    chunk_index: 0,
    rank: 1,
    snippet: 'Встреча у ворот',
  }
  const merged = mergeChronicleToolHits([[
    { ...base, source_scope: 'official' },
    { ...base, source_scope: 'personal' },
  ]])
  assert.equal(merged.length, 2)
  assert.deepEqual(new Set(merged.map(item => item.source_scope)), new Set(['official', 'personal']))
})

console.log(`\n${passed} tests passed`)
