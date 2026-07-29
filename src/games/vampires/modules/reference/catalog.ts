export type ReferenceDocGroup = 'navigator' | 'chapters' | 'handbooks'

export type ReferenceDocument = {
  slug: string
  title: string
  shortTitle: string
  description: string
  group: ReferenceDocGroup
  /** Path relative to `/vampires/reference/vtm-v5/`. */
  file: string
  aliases: string[]
}

export const REFERENCE_BASE_PATH = '/vampires/reference/vtm-v5'

export const REFERENCE_DOCUMENTS: ReferenceDocument[] = [
  {
    slug: 'navigator',
    title: 'VtM V5 — Навигатор',
    shortTitle: 'Навигатор',
    description: 'Точка входа: выбери раздел по цели.',
    group: 'navigator',
    file: '00. VtM V5 — Навигатор.md',
    aliases: ['00. VtM V5 — Навигатор'],
  },
  {
    slug: 'world',
    title: '01. Мир Тьмы и Общество',
    shortTitle: 'Мир Тьмы',
    description: 'Лор, Маскарад, секты, общество Сородичей.',
    group: 'chapters',
    file: '01. Мир Тьмы и Общество.md',
    aliases: ['01. Мир Тьмы и Общество', '../01. Мир Тьмы и Общество'],
  },
  {
    slug: 'clans',
    title: '02. Кланы и Линии крови',
    shortTitle: 'Кланы',
    description: 'Кланы, дисциплины кланов, изъяны, линии крови.',
    group: 'chapters',
    file: '02. Кланы и Линии крови.md',
    aliases: ['02. Кланы и Линии крови', '../02. Кланы и Линии крови'],
  },
  {
    slug: 'character-creation',
    title: '03. Создание Персонажа',
    shortTitle: 'Создание персонажа',
    description: 'Атрибуты, навыки, котерия, предыстория.',
    group: 'chapters',
    file: '03. Создание Персонажа.md',
    aliases: ['03. Создание Персонажа', '../03. Создание Персонажа'],
  },
  {
    slug: 'vampire-nature',
    title: '04. Вампирская природа',
    shortTitle: 'Вампирская природа',
    description: 'Голод, Узы, торпор, кровь и внутренние механики.',
    group: 'chapters',
    file: '04. Вампирская природа.md',
    aliases: ['04. Вампирская природа', '../04. Вампирская природа'],
  },
  {
    slug: 'disciplines',
    title: '05. Дисциплины',
    shortTitle: 'Дисциплины',
    description: 'Силы крови, уровни, описания дисциплин.',
    group: 'chapters',
    file: '05. Дисциплины.md',
    aliases: ['05. Дисциплины', '../05. Дисциплины'],
  },
  {
    slug: 'game-rules',
    title: '06. Правила Игры',
    shortTitle: 'Правила игры',
    description: 'Броски, сложность, урон, конфликты.',
    group: 'chapters',
    file: '06. Правила Игры.md',
    aliases: ['06. Правила Игры', '../06. Правила Игры'],
  },
  {
    slug: 'npcs',
    title: '07. Противники и NPC',
    shortTitle: 'Противники и NPC',
    description: 'Шаблоны NPC и быстрые противники для мастера.',
    group: 'chapters',
    file: '07. Противники и NPC.md',
    aliases: ['07. Противники и NPC', '../07. Противники и NPC'],
  },
  {
    slug: 'combat',
    title: 'Бой — Полный справочник',
    shortTitle: 'Бой',
    description: 'Расширенная механика боя, оружие, погони, броня.',
    group: 'handbooks',
    file: 'Справочники/Бой — Полный справочник.md',
    aliases: [
      'Справочники/Бой — Полный справочник',
      'Бой — Полный справочник',
      '../Справочники/Бой — Полный справочник',
    ],
  },
  {
    slug: 'masquerade',
    title: 'Маскарад — Механика и нарушения',
    shortTitle: 'Маскарад',
    description: 'Нарушения, Cover-Up, реакция мира.',
    group: 'handbooks',
    file: 'Справочники/Маскарад — Механика и нарушения.md',
    aliases: [
      'Справочники/Маскарад — Механика и нарушения',
      'Маскарад — Механика и нарушения',
      '../Справочники/Маскарад — Механика и нарушения',
    ],
  },
  {
    slug: 'domain',
    title: 'Домен и Политика',
    shortTitle: 'Домен',
    description: 'Домен, должности, Элизиум, Примоген.',
    group: 'handbooks',
    file: 'Справочники/Домен и Политика.md',
    aliases: [
      'Справочники/Домен и Политика',
      'Домен и Политика',
      '../Справочники/Домен и Политика',
    ],
  },
  {
    slug: 'humanity',
    title: 'Человечность — Состояния и Расстройства',
    shortTitle: 'Человечность',
    description: 'Шкала, пятна, порывы, расстройства, Голконда.',
    group: 'handbooks',
    file: 'Справочники/Человечность — Состояния и Расстройства.md',
    aliases: [
      'Справочники/Человечность — Состояния и Расстройства',
      'Человечность — Состояния и Расстройства',
      '../Справочники/Человечность — Состояния и Расстройства',
    ],
  },
  {
    slug: 'glossary',
    title: 'Глоссарий V5',
    shortTitle: 'Глоссарий',
    description: 'Алфавитный словарь терминов V5.',
    group: 'handbooks',
    file: 'Справочники/Глоссарий V5.md',
    aliases: ['Справочники/Глоссарий V5', 'Глоссарий V5', '../Справочники/Глоссарий V5'],
  },
  {
    slug: 'reputation',
    title: 'Система Репутации',
    shortTitle: 'Репутация',
    description: 'Фракционные отношения для кампании.',
    group: 'handbooks',
    file: 'Справочники/Система Репутации.md',
    aliases: [
      'Справочники/Система Репутации',
      'Система Репутации',
      '../Справочники/Система Репутации',
    ],
  },
]

export const DEFAULT_REFERENCE_DOC_SLUG = 'navigator'

const slugByAlias = new Map<string, string>()

REFERENCE_DOCUMENTS.forEach(doc => {
  slugByAlias.set(doc.slug, doc.slug)
  slugByAlias.set(doc.file.replace(/\.md$/, ''), doc.slug)
  slugByAlias.set(doc.title, doc.slug)
  doc.aliases.forEach(alias => slugByAlias.set(alias, doc.slug))
})

export function getReferenceDocument(slug: string | null | undefined) {
  return REFERENCE_DOCUMENTS.find(doc => doc.slug === slug) || null
}

export function getReferenceDocumentUrl(slug: string, hash = '') {
  const params = new URLSearchParams({ doc: slug })
  return `/vampires/reference?${params.toString()}${hash ? `#${hash}` : ''}`
}

export function getReferenceFileUrl(file: string) {
  return `${REFERENCE_BASE_PATH}/${file.split('/').map(part => encodeURIComponent(part)).join('/')}`
}

function normalizeWikiPath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\.md$/i, '')
    .trim()
}

function resolveRelativeWikiPath(currentFile: string, target: string) {
  const normalized = normalizeWikiPath(target)
  if (!normalized.includes('../')) return normalized

  const currentParts = currentFile.split('/')
  currentParts.pop()
  const targetParts = normalized.split('/')

  targetParts.forEach(part => {
    if (part === '..') currentParts.pop()
    else if (part !== '.') currentParts.push(part)
  })

  return currentParts.join('/')
}

export function resolveWikiLink(currentFile: string, rawTarget: string) {
  const [pathPart, hashPart = ''] = rawTarget.split('#')
  const resolvedPath = resolveRelativeWikiPath(currentFile, pathPart)
  const slug = slugByAlias.get(resolvedPath) || slugByAlias.get(pathPart.trim()) || null
  if (!slug) return null

  const hash = hashPart
    ? hashPart
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
    : ''

  return { slug, hash }
}

export const REFERENCE_GROUP_LABELS: Record<ReferenceDocGroup, string> = {
  navigator: 'Старт',
  chapters: 'Основные разделы',
  handbooks: 'Справочники',
}