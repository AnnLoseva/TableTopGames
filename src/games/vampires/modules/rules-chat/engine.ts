// Движок чата-библиотекаря: понимание запроса без внешнего ИИ.
// 1) распознаёт сущности (клан, дисциплина, сила, преимущество, хищник,
//    навык, атрибут, тема правил) в rules.json и строит структурный ответ;
// 2) отвечает на личные вопросы: лист персонажа (только владельца, через
//    security definer RPC get_my_characters) и дневник (localStorage игрока);
// 3) ищет по справочнику (modules/reference) и книгам (book_pages);
// 4) чистит запрос от слов-паразитов и фильтра издания для FTS.

import { REFERENCE_DOCUMENTS, getReferenceDocumentUrl, getReferenceFileUrl, type ReferenceDocument } from '@/games/vampires/modules/reference/catalog'
import { preprocessReferenceMarkdown, searchReferenceCorpus, type ReferenceSearchHit } from '@/games/vampires/modules/reference/utils/markdown'
import { loadVampireRulesDocument } from '@/games/vampires/lib/rules-catalog-client'

export type { ReferenceSearchHit }

export type RulesData = {
  clans: Record<string, ClanInfo>
  disciplines: Record<string, DisciplineInfo>
  advantages: { merits: Record<string, MeritInfo>; flaws: Record<string, MeritInfo> }
  predator_types: Record<string, PredatorInfo>
  skills: Record<string, unknown>
  attributes: Record<string, unknown>
}

export type ClanInfo = {
  description?: unknown
  disciplines?: string[]
  bane?: unknown
  playstyle?: unknown
  conflict?: unknown
}

// Поля rules.json бывают строками, списками или вложенными объектами
// (например disciplines[*].system = {type, masquerade, resonance, limitations}),
// поэтому значения типизируем как unknown и рендерим через безопасный хелпер.
export type DisciplinePower = {
  description?: unknown
  pool?: unknown
  cost?: unknown
  effect?: unknown
}

export type DisciplineInfo = {
  description?: unknown
  system?: unknown
  powers?: Record<string, Record<string, DisciplinePower>>
}

const VALUE_LABELS: Record<string, string> = {
  type: 'Тип',
  masquerade: 'Маскарад',
  resonance: 'Резонанс',
  limitations: 'Ограничения',
}

// Приводит любое значение rules.json к строке для рендера. null — не показывать.
export function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value.map(asText).filter((part): part is string => Boolean(part))
    return parts.length ? parts.join(', ') : null
  }
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = asText(item)
        return text ? `${VALUE_LABELS[key] || key}: ${text}` : null
      })
      .filter((part): part is string => Boolean(part))
    return parts.length ? parts.join('\n') : null
  }
  return null
}

export type MeritInfo = {
  'название'?: string
  'описание'?: unknown
  'варианты'?: Array<{ 'название_пункта'?: string; 'точки'?: number; 'полное_описание'?: unknown }>
}

export type PredatorInfo = {
  description?: unknown
  specialty?: unknown
  disciplines?: string[]
  advantages?: unknown
  disadvantages?: unknown
}

export type EntityMatch =
  | { kind: 'clan'; name: string; data: ClanInfo }
  | { kind: 'discipline'; name: string; data: DisciplineInfo }
  | { kind: 'power'; name: string; discipline: string; level: string; data: DisciplinePower }
  | { kind: 'merit'; name: string; flaw: boolean; data: MeritInfo }
  | { kind: 'predator'; name: string; data: PredatorInfo }
  | { kind: 'skill'; name: string; data: unknown }
  | { kind: 'attribute'; name: string; data: unknown }
  | { kind: 'topic'; name: string; data: unknown }

export type ParsedQuery = {
  entities: EntityMatch[]
  ftsQuery: string
  source: string | null
  personal: boolean
  journal: boolean
  searchBooks: boolean
}

export type BookHit = {
  source: string
  title: string
  page: number
  rank: number
  snippet: string
}

export type BookSearchPlan = {
  queries: string[]
  referenceQuery: string
  source: string | null
  isLibraryQuestion: boolean
}

export const RULES_EDITION_MODES = [
  'V5',
  'V20',
  'general',
] as const

export type RulesEditionMode = (typeof RULES_EDITION_MODES)[number]

export const DEFAULT_RULES_EDITION: RulesEditionMode = 'V5'

const RULES_EDITION_SOURCES = {
  V5: 'v5-corebook-ru',
  V20: 'v20-corebook-ru',
  general: null,
} as const satisfies Record<RulesEditionMode, string | null>

export const RULES_EDITION_LABELS = {
  V5: 'V5',
  V20: 'V20',
  general: 'Общие',
} as const satisfies Record<RulesEditionMode, string>

export function sourceForEditionMode(mode: RulesEditionMode): string | null {
  return RULES_EDITION_SOURCES[mode]
}

export const RULEBOOK_LIBRARY = [
  { source: RULES_EDITION_SOURCES.V5, edition: 'V5', title: 'VTM v5: Книга правил (RU)' },
  { source: RULES_EDITION_SOURCES.V20, edition: 'V20', title: 'VTM V20: Юбилейное издание (RU)' },
] as const

let rulesCache: RulesData | null = null
let rulesPromise: Promise<RulesData | null> | null = null

export async function loadRules(): Promise<RulesData | null> {
  if (rulesCache) return rulesCache
  if (!rulesPromise) {
    rulesPromise = loadVampireRulesDocument('ru')
      .then(data => {
        rulesCache = data as RulesData
        return rulesCache
      })
      .catch(() => null)
  }
  return rulesPromise
}

const FILLER_WORDS = new Set([
  'объясни', 'объясните', 'расскажи', 'расскажите', 'покажи', 'покажите',
  'скажи', 'скажите', 'опиши', 'опишите', 'дай', 'дайте', 'найди', 'найдите',
  'что', 'чем', 'кто', 'такое', 'такой', 'такая', 'такие', 'это', 'эта', 'этот',
  'как', 'работает', 'работают', 'значит', 'означает', 'мне', 'нам',
  'пожалуйста', 'плз', 'инфа', 'инфо', 'информация', 'подробнее', 'про', 'насчет', 'насчёт',
  'если', 'тогда', 'потом', 'вообще', 'теории', 'происходит', 'произойдет', 'произойдёт',
  'будет', 'будут', 'нужно', 'можно', 'каждый', 'каждая', 'каждое', 'каждую',
])

export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9-]/g, '')
}

// Грубое стемм-сравнение для русской морфологии: совпадение по началу слова.
export function stemEquals(token: string, word: string): boolean {
  if (!token || !word) return false
  if (token === word) return true
  const stem = word.length > 5 ? word.slice(0, word.length - 2) : word.slice(0, Math.max(4, word.length - 1))
  return token.startsWith(stem) && token.length <= word.length + 3
}

function nameMatches(tokens: string[], name: string): boolean {
  const words = name.toLowerCase().replace(/ё/g, 'е').split(/[\s-]+/).map(normalizeToken).filter(Boolean)
  if (words.length === 0) return false
  return words.every(word => tokens.some(token => stemEquals(token, word)))
}

const V5_HINTS = ['v5', 'в5', 'пятерка', 'пятерке', 'пятой', 'пятая']
const V20_HINTS = ['v20', 'в20', 'двадцатка', 'двадцатке', 'двадцатой']

// Маркеры «вопрос о моём»: лист, персонаж, дневник, сессии.
const MY_MARKERS = new Set([
  'мой', 'моя', 'мое', 'моё', 'мои', 'моего', 'моей', 'моих', 'моем', 'моём',
  'меня', 'мне', 'я', 'свой', 'своя', 'своего', 'своей', 'свои', 'своих',
])
const POSSESSIVE_MARKERS = new Set([
  'мой', 'моя', 'мое', 'моё', 'мои', 'моего', 'моей', 'моих', 'моем', 'моём',
  'свой', 'своя', 'свое', 'своё', 'своего', 'своей', 'свои', 'своих',
])
const PERSONAL_HINTS = ['персонаж', 'лист', 'предыстор', 'бэкстор', 'бекстор']
const PERSONAL_DATA_HINTS = [
  'клан', 'поколени', 'концепт', 'натур', 'маска', 'сир', 'хищник', 'внешност',
  'атрибут', 'навык', 'дисциплин', 'преимуществ', 'недостат', 'инвентар', 'замет',
]
const JOURNAL_HINTS = ['дневник', 'сесси', 'запис', 'заметк', 'было']
const RULE_QUESTION_HINTS = [
  'если', 'произойд', 'случ', 'последств', 'правил', 'механик', 'теори', 'почему',
  'означ', 'работа', 'кажд', 'голод', 'кров', 'пробуж', 'просып', 'пит', 'ярост',
]

// Темы правил из rules.json: здоровье, сила воли, человечность, броски.
const TOPIC_KEYWORDS: Array<{ keys: string[]; field: keyof RulesData | string; title: string }> = [
  { keys: ['здоровь', 'урон', 'ранен'], field: 'health', title: 'Здоровье' },
  { keys: ['воли', 'воля'], field: 'willpower', title: 'Сила воли' },
  { keys: ['человечност'], field: 'humanity_rules', title: 'Человечность' },
  { keys: ['бросок', 'броски', 'проверк', 'дайс'], field: 'rolls', title: 'Броски' },
]

export function parseQuery(
  question: string,
  rules: RulesData | null,
  preferredEdition?: RulesEditionMode,
): ParsedQuery {
  const rawTokens = question.split(/\s+/).map(normalizeToken).filter(Boolean)

  let source = preferredEdition === undefined ? null : sourceForEditionMode(preferredEdition)
  const tokens: string[] = []
  for (const token of rawTokens) {
    if (V5_HINTS.includes(token)) { source = 'v5-corebook-ru'; continue }
    if (V20_HINTS.includes(token)) { source = 'v20-corebook-ru'; continue }
    tokens.push(token)
  }

  const normalizedQuestion = question.toLowerCase().replace(/ё/g, 'е')
  const hasPersonalOwner = tokens.some(token => POSSESSIVE_MARKERS.has(token))
    || normalizedQuestion.includes('у меня')
  const journal = tokens.some(token => JOURNAL_HINTS.some(hint => token.startsWith(hint)))
  const hasPersonalSubject = tokens.some(token =>
    PERSONAL_HINTS.some(hint => token.startsWith(hint))
    || PERSONAL_DATA_HINTS.some(hint => token.startsWith(hint)))
  const hasRulesIntent = tokens.some(token => RULE_QUESTION_HINTS.some(hint => token.startsWith(hint)))
  const personal = journal || (hasPersonalOwner && (hasPersonalSubject || !hasRulesIntent))
  const searchBooks = !journal && (!personal || hasRulesIntent)

  const entities: EntityMatch[] = []
  if (rules) {
    for (const [name, data] of Object.entries(rules.clans || {})) {
      if (nameMatches(tokens, name)) entities.push({ kind: 'clan', name, data })
    }
    for (const [name, data] of Object.entries(rules.disciplines || {})) {
      if (nameMatches(tokens, name)) entities.push({ kind: 'discipline', name, data })
    }
    // Силы дисциплин ищем, только если сама дисциплина не распознана —
    // например «Благоговение» без слова «Величие».
    if (!entities.some(e => e.kind === 'discipline')) {
      outer: for (const [disciplineName, discipline] of Object.entries(rules.disciplines || {})) {
        for (const [level, powers] of Object.entries(discipline.powers || {})) {
          for (const [powerName, power] of Object.entries(powers || {})) {
            if (nameMatches(tokens, powerName)) {
              entities.push({ kind: 'power', name: powerName, discipline: disciplineName, level, data: power })
              if (entities.length >= 3) break outer
            }
          }
        }
      }
    }
    for (const flag of [false, true] as const) {
      const group = flag ? rules.advantages?.flaws : rules.advantages?.merits
      for (const [key, data] of Object.entries(group || {})) {
        const display = data['название'] || key
        if (nameMatches(tokens, display) || nameMatches(tokens, key)) {
          entities.push({ kind: 'merit', name: display, flaw: flag, data })
        }
      }
    }
    for (const [name, data] of Object.entries(rules.predator_types || {})) {
      if (nameMatches(tokens, name)) entities.push({ kind: 'predator', name, data })
    }
    // Навыки и атрибуты показываем как справку, только если это не личный
    // вопрос («моя сила» — про лист, «сила» — про правило).
    if (!personal) {
      for (const [name, data] of Object.entries(rules.skills || {})) {
        if (nameMatches(tokens, name)) entities.push({ kind: 'skill', name, data })
      }
      for (const [name, data] of Object.entries(rules.attributes || {})) {
        if (nameMatches(tokens, name)) entities.push({ kind: 'attribute', name, data })
      }
    }
    for (const topic of TOPIC_KEYWORDS) {
      const rulesRecord = rules as unknown as Record<string, unknown>
      if (tokens.some(token => topic.keys.some(key => token.startsWith(key))) && rulesRecord[topic.field]) {
        entities.push({ kind: 'topic', name: topic.title, data: rulesRecord[topic.field] })
      }
    }
  }

  const meaningful = tokens.filter(token => !FILLER_WORDS.has(token) && token.length > 1)
  const ftsQuery = meaningful.join(' ')

  return { entities: entities.slice(0, 3), ftsQuery, source, personal, journal, searchBooks }
}

// ─── Поисковый план по книгам ───────────────────────────────────────────────

const SEARCH_STOP_WORDS = new Set([
  ...FILLER_WORDS,
  ...MY_MARKERS,
  'и', 'а', 'но', 'или', 'либо', 'не', 'ни', 'ну', 'вот', 'же', 'бы',
  'в', 'во', 'на', 'у', 'с', 'со', 'к', 'ко', 'от', 'до', 'по', 'для', 'за',
  'из', 'при', 'через', 'после', 'перед', 'между', 'тебя', 'тебе', 'есть',
  'какие', 'какой', 'какая', 'какое', 'персонаж', 'персонажа', 'вампир', 'вампира',
])

const FOLLOW_UP_HINTS = new Set([
  'это', 'этот', 'эта', 'так', 'тогда', 'потом', 'дальше', 'еще', 'ещё', 'теории',
])

function canonicalSearchToken(token: string): string {
  if (token.startsWith('голод')) return 'голод'
  if (token.startsWith('кров')) return 'кровь'
  if (token.startsWith('ноч')) return 'ночь'
  if (token.startsWith('пробуж') || token.startsWith('просып') || token.startsWith('просну')) return 'пробуждение'
  if (token.startsWith('проверк') || token.startsWith('испыт')) return 'испытание'
  if (token.startsWith('насыщ') || token.startsWith('корм') || token.startsWith('питан')) return 'насыщение'
  if (token.startsWith('воздерж')) return 'воздерживаться'
  if (token.startsWith('ярост')) return 'ярость'
  if (['пил', 'пила', 'пили', 'пить', 'пью', 'пьешь', 'пьеш', 'пьет', 'пьют'].includes(token)) return 'пить'
  return token
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)]
}

function getRuleSearchTokens(question: string): string[] {
  return uniqueTokens(
    question
      .split(/\s+/)
      .map(normalizeToken)
      .filter(token => token && !SEARCH_STOP_WORDS.has(token))
      .filter(token => !V5_HINTS.includes(token) && !V20_HINTS.includes(token))
      .filter(token => token.length > 2 && !/^\d+$/.test(token))
      .map(canonicalSearchToken),
  ).slice(0, 8)
}

function sourceFromQuestion(question: string): string | null {
  const tokens = question.split(/\s+/).map(normalizeToken).filter(Boolean)
  if (tokens.some(token => V5_HINTS.includes(token))) return 'v5-corebook-ru'
  if (tokens.some(token => V20_HINTS.includes(token))) return 'v20-corebook-ru'
  return null
}

function isLikelyFollowUp(question: string, tokens: string[]): boolean {
  const rawTokens = question.split(/\s+/).map(normalizeToken).filter(Boolean)
  return tokens.length < 2
    || rawTokens.some(token => FOLLOW_UP_HINTS.has(token))
    || rawTokens[0] === 'а'
    || rawTokens[0] === 'ну'
}

export function isLibraryInventoryQuestion(question: string): boolean {
  const normalized = question.toLowerCase().replace(/ё/g, 'е')
  const tokens = normalized.split(/\s+/).map(normalizeToken).filter(Boolean)
  const mentionsLibrary = tokens.some(token =>
    token.startsWith('материал')
    || token.startsWith('книг')
    || token.startsWith('библиотек')
    || token.startsWith('источник'))
  const asksAvailability = normalized.includes('у тебя')
    || normalized.includes('у вас')
    || tokens.some(token => token.startsWith('доступ') || token.startsWith('имеющ'))
    || (tokens.some(token => token === 'какие') && tokens.some(token => token === 'есть'))
  return mentionsLibrary && asksAvailability
}

export function buildBookSearchPlan(
  question: string,
  previousUserQuestions: string[] = [],
  preferredEdition?: RulesEditionMode,
): BookSearchPlan {
  const isLibraryQuestion = isLibraryInventoryQuestion(question)
  const currentTokens = getRuleSearchTokens(question)
  const followUp = isLikelyFollowUp(question, currentTokens)
  const previousQuestion = previousUserQuestions.at(-1) || ''
  const previousTokens = followUp ? getRuleSearchTokens(previousQuestion) : []
  const tokens = uniqueTokens([...currentTokens, ...previousTokens]).slice(0, 8)
  const questionSource = sourceFromQuestion(question)
  const source = questionSource
    ?? (preferredEdition === undefined
      ? (followUp ? sourceFromQuestion(previousQuestion) : null)
      : sourceForEditionMode(preferredEdition))

  if (isLibraryQuestion) {
    return { queries: [], referenceQuery: '', source, isLibraryQuestion: true }
  }

  const queries: string[] = []
  const has = (...values: string[]) => values.some(value => tokens.includes(value))
  const hungerTopic = has('голод')
    || (has('кровь') && has('ночь', 'пить', 'пробуждение', 'насыщение', 'воздерживаться'))
  const abstinenceTopic = has('воздерживаться') || (has('пить', 'кровь') && has('ночь'))

  if (hungerTopic && source !== 'v20-corebook-ru') {
    // Эти формулировки намеренно повторяют терминологию V5: первая находит
    // результат испытания Крови, вторая — обязательную проверку при
    // пробуждении, третья — правило роста Голода.
    queries.push(
      'испытание крови голод',
      'каждый пробуждение испытание крови',
      'голод закат',
      'утоление голода',
    )
  }

  if (abstinenceTopic && source !== 'v5-corebook-ru') {
    queries.push('воздерживаться пища', 'запас крови ночь')
  }

  if (tokens.length) {
    queries.push(tokens.join(' '))
    if (!hungerTopic && tokens.length > 1) queries.push(tokens.join(' OR '))
  }

  return {
    queries: [...new Set(queries)].slice(0, 7),
    referenceQuery: hungerTopic && source !== 'v20-corebook-ru' ? 'голод' : tokens.join(' '),
    source,
    isLibraryQuestion: false,
  }
}

export function mergeBookHitLists(hitLists: BookHit[][], maxHits = 8): BookHit[] {
  const merged = new Map<string, { hit: BookHit; score: number; bestPosition: number }>()
  hitLists.forEach(hits => {
    hits.forEach((hit, position) => {
      const key = `${hit.source}:${hit.page}`
      const score = 1 / (60 + position + 1)
      const current = merged.get(key)
      if (current) {
        current.score += score
        current.bestPosition = Math.min(current.bestPosition, position)
      } else {
        merged.set(key, { hit, score, bestPosition: position })
      }
    })
  })

  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.bestPosition - b.bestPosition || a.hit.page - b.hit.page)
    .slice(0, maxHits)
    .map(({ hit, score }) => ({ ...hit, rank: score }))
}

// ─── Дневник игрока (localStorage, никуда не отправляется) ──────────────────

export type JournalHit = {
  title: string
  date: string
  excerpt: string
}

type StoredJournalEntry = {
  title?: string
  text?: string
  updatedAt?: string
  createdAt?: string
}

export function searchJournal(tokens: string[], legacyUserId: string | null): JournalHit[] {
  if (typeof window === 'undefined' || !legacyUserId) return []
  const prefix = `vtm-journal:${legacyUserId}:`
  const entries: Array<StoredJournalEntry & { room: string }> = []
  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith(prefix)) continue
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as StoredJournalEntry[]
      const room = key.slice(prefix.length)
      for (const entry of parsed) entries.push({ ...entry, room })
    } catch {
      // битые записи пропускаем
    }
  }
  if (entries.length === 0) return []

  const meaningful = tokens.filter(token =>
    !FILLER_WORDS.has(token)
    && !MY_MARKERS.has(token)
    && !JOURNAL_HINTS.some(hint => token.startsWith(hint))
    && token.length > 2)

  const scored = entries.map(entry => {
    const haystack = normalizeHaystack(`${entry.title || ''} ${entry.text || ''}`)
    let score = 0
    let firstIndex = -1
    for (const token of meaningful) {
      const index = haystack.indexOf(token.slice(0, Math.max(3, token.length - 2)))
      if (index >= 0) {
        score += 1
        if (firstIndex < 0) firstIndex = index
      }
    }
    return { entry, score, firstIndex }
  })

  const matched = meaningful.length
    ? scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score)
    : scored.sort((a, b) =>
        (b.entry.updatedAt || b.entry.createdAt || '').localeCompare(a.entry.updatedAt || a.entry.createdAt || ''))

  return matched.slice(0, 4).map(({ entry, firstIndex }) => {
    const text = (entry.text || '').replace(/\s+/g, ' ').trim()
    const start = Math.max(0, (firstIndex >= 0 ? firstIndex : 0) - 80)
    const excerpt = (start > 0 ? '…' : '') + text.slice(start, start + 280) + (text.length > start + 280 ? '…' : '')
    return {
      title: entry.title || 'Без названия',
      date: (entry.updatedAt || entry.createdAt || '').slice(0, 10),
      excerpt,
    }
  })
}

function normalizeHaystack(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е')
}

// ─── Справочник (modules/reference) ─────────────────────────────────────────

type ReferenceCorpus = Array<{ doc: ReferenceDocument; markdown: string }>
let corpusCache: ReferenceCorpus | null = null
let corpusPromise: Promise<ReferenceCorpus | null> | null = null

async function loadReferenceCorpus() {
  if (corpusCache) return corpusCache
  if (!corpusPromise) {
    corpusPromise = Promise.all(
      REFERENCE_DOCUMENTS.map(async doc => {
        const response = await fetch(getReferenceFileUrl(doc.file))
        if (!response.ok) throw new Error(`reference fetch failed: ${doc.file}`)
        const raw = await response.text()
        return { doc, markdown: preprocessReferenceMarkdown(raw, doc.file) }
      }),
    )
      .then(entries => {
        corpusCache = entries
        return entries
      })
      .catch(error => {
        console.error('Справочник не загрузился:', error)
        corpusPromise = null
        return null
      })
  }
  return corpusPromise
}

export async function searchReference(query: string): Promise<Array<ReferenceSearchHit & { url: string }>> {
  const corpus = await loadReferenceCorpus()
  if (!corpus) return []
  return searchReferenceCorpus(corpus, query)
    .slice(0, 4)
    .map(hit => ({ ...hit, url: getReferenceDocumentUrl(hit.doc.slug, hit.slug) }))
}
