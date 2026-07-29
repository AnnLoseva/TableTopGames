export type LibrarianCharacterRow = {
  id: string
  name: string
  clan: string | null
  data: Record<string, unknown>
}

export type LibrarianBookHit = {
  source: string
  title: string
  page: number
  rank: number
  snippet: string
}

export type LibrarianChronicleHit = {
  chronicle_id: string
  chronicle_title: string
  document_title: string
  section_title: string
  chunk_index: number
  rank: number
  snippet: string
  source_scope?: 'official' | 'personal'
}

export type RulesEditionMode = 'V5' | 'V20' | 'general'
export type RulebookSearchEdition = 'V5' | 'V20' | 'all'
export type EditionFallback = {
  preferredEdition: Exclude<RulesEditionMode, 'general'>
  searchedEdition: Exclude<RulebookSearchEdition, 'all'>
}

export function normalizePreferredEdition(value: unknown): RulesEditionMode {
  return value === 'V20' || value === 'general' ? value : 'V5'
}

export function sourceForEdition(edition: unknown): string | null {
  if (edition === 'V5') return 'v5-corebook-ru'
  if (edition === 'V20') return 'v20-corebook-ru'
  return null
}

export function otherEdition(edition: 'V5' | 'V20'): 'V5' | 'V20' {
  return edition === 'V5' ? 'V20' : 'V5'
}

export function editionFallbackForSearch(
  preferredEdition: RulesEditionMode,
  searchedEdition: RulebookSearchEdition,
  hitCount: number,
): EditionFallback | null {
  if (
    hitCount <= 0
    || preferredEdition === 'general'
    || searchedEdition === 'all'
    || preferredEdition === searchedEdition
  ) {
    return null
  }
  return { preferredEdition, searchedEdition }
}

export function shouldFlagEditionFallback(
  preferredEdition: RulesEditionMode,
  searchedEdition: RulebookSearchEdition,
  hitCount: number,
): boolean {
  return editionFallbackForSearch(preferredEdition, searchedEdition, hitCount) !== null
}

export function editionFallbackWarning(fallback: EditionFallback): string {
  return `В выбранной редакции ${fallback.preferredEdition} не найдено; ниже информация из ${fallback.searchedEdition}.`
}

function hasExplicitEditionFallbackWarning(answer: string, fallback: EditionFallback): boolean {
  const normalized = answer
    .normalize('NFKC')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  const preferredMarker = `в выбранной редакции ${fallback.preferredEdition.toLowerCase()}`
  const preferredIndex = normalized.indexOf(preferredMarker)
  if (preferredIndex < 0) return false

  const searchedMarker = fallback.searchedEdition.toLowerCase()
  const searchedIndex = normalized.indexOf(
    searchedMarker,
    preferredIndex + preferredMarker.length,
  )
  if (searchedIndex < 0 || searchedIndex - preferredIndex > 360) return false

  const warning = normalized.slice(
    preferredIndex,
    searchedIndex + searchedMarker.length,
  )
  const saysMissing = /(?:не\s+найд\w*|не\s+наш\w*|нет\s+(?:точн\w+\s+)?(?:ответ\w*|информац\w*|сведен\w*|фрагмент\w*|правил\w*))/u.test(warning)
  const introducesFallback = /(?:ниже|далее|следующ\w*|информац\w*|сведен\w*|данн\w*|использ\w*|взят\w*|из\s+редакц\w*|(?:а|но)\s+в)/u.test(warning)
  return saysMissing && introducesFallback
}

export function ensureEditionFallbackWarning(
  answer: string,
  fallback: EditionFallback | null,
): string {
  if (!fallback || hasExplicitEditionFallbackWarning(answer, fallback)) return answer
  return `${editionFallbackWarning(fallback)}\n\n${answer}`
}

const NAME_STOP_WORDS = new Set([
  'и', 'а', 'но', 'или', 'and', 'персонаж', 'персонажа', 'персонажи',
])

const CHARACTER_DETAIL_FIELDS = [
  'type', 'status', 'concept', 'nature', 'mask', 'sire', 'generation',
  'predator', 'appearance', 'backstory', 'notes', 'touchstones', 'merits',
  'flaws', 'inventory', 'humanity', 'morality', 'bloodPotency', 'healthState',
  'vitalTrackers', 'damageProfile', 'attributes', 'skills', 'disciplines',
  'selectedPowers', 'clanBane', 'trueAge', 'apparentAge', 'birthDate',
  'deathDate',
] as const

function normalizeNameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !NAME_STOP_WORDS.has(token))
}

function tokensMatch(left: string, right: string): boolean {
  if (left === right) return true
  if (Math.min(left.length, right.length) < 3) return false
  return left.startsWith(right) || right.startsWith(left)
}

export function selectCharacterRows(
  characters: LibrarianCharacterRow[],
  requestedNames: string[],
): LibrarianCharacterRow[] {
  const requestedTokens = requestedNames.flatMap(normalizeNameTokens)
  if (requestedTokens.length === 0) return []

  return characters.filter(character => {
    const characterTokens = normalizeNameTokens(character.name || '')
    return characterTokens.some(characterToken =>
      requestedTokens.some(requestedToken => tokensMatch(characterToken, requestedToken)))
  })
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim()
    return normalized.length > 6000 ? `${normalized.slice(0, 6000)}…` : normalized
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth >= 5) return '[вложенные данные сокращены]'
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeValue(item, depth + 1))
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      const normalizedKey = key.toLowerCase()
      if (normalizedKey.includes('image') || normalizedKey.includes('portrait') || normalizedKey.includes('base64')) {
        continue
      }
      result[key] = sanitizeValue(item, depth + 1)
    }
    return result
  }
  return String(value)
}

function characterSummary(character: LibrarianCharacterRow) {
  const data = character.data || {}
  return {
    name: character.name,
    clan: data.clan ?? character.clan,
    concept: data.concept ?? null,
  }
}

function characterDetails(character: LibrarianCharacterRow) {
  const data = character.data || {}
  const details: Record<string, unknown> = {
    name: character.name,
    clan: data.clan ?? character.clan,
  }
  for (const field of CHARACTER_DETAIL_FIELDS) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      details[field] = sanitizeValue(data[field])
    }
  }
  return details
}

export function buildCharacterToolPayload(
  characters: LibrarianCharacterRow[],
  requestedNames: string[],
) {
  if (requestedNames.flatMap(normalizeNameTokens).length === 0) {
    return {
      mode: 'overview',
      characters: characters.slice(0, 50).map(characterSummary),
      note: 'Для полного листа вызови инструмент ещё раз с именем персонажа.',
    }
  }

  const selected = selectCharacterRows(characters, requestedNames).slice(0, 6)
  return {
    mode: 'details',
    characters: selected.map(characterDetails),
    availableCharacters: selected.length === 0
      ? characters.slice(0, 50).map(character => character.name)
      : undefined,
  }
}

export function mergeBookToolHits(hitLists: LibrarianBookHit[][], maxHits = 8): LibrarianBookHit[] {
  const merged = new Map<string, { hit: LibrarianBookHit; score: number; bestPosition: number }>()
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

export function mergeChronicleToolHits(
  hitLists: LibrarianChronicleHit[][],
  maxHits = 10,
): LibrarianChronicleHit[] {
  const merged = new Map<string, { hit: LibrarianChronicleHit; score: number; bestPosition: number }>()
  hitLists.forEach(hits => {
    hits.forEach((hit, position) => {
      const key = `${hit.source_scope || 'official'}:${hit.chronicle_id}:${hit.document_title}:${hit.chunk_index}`
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
    .sort((a, b) => b.score - a.score
      || a.bestPosition - b.bestPosition
      || a.hit.document_title.localeCompare(b.hit.document_title, 'ru')
      || a.hit.chunk_index - b.hit.chunk_index)
    .slice(0, maxHits)
    .map(({ hit, score }) => ({ ...hit, rank: score }))
}
