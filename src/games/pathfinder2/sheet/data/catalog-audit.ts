import type {
  Pathfinder2CatalogAvailability,
  Pathfinder2CatalogId,
} from '../types'

type UnknownRecord = Record<string, unknown>

export type Pathfinder2RuleDocumentsForAudit = {
  ancestries: unknown
  backgrounds: unknown
  classes: unknown
  feats: unknown
  archetypes?: unknown
  spells?: unknown
  armor?: unknown
  weapons?: unknown
  shields?: unknown
  equipment?: unknown[]
}

type AvailabilitySeed = Omit<
  Pathfinder2CatalogAvailability,
  'status' | 'entryCount' | 'issues'
>

const CATALOG_REQUIREMENTS: AvailabilitySeed[] = [
  {
    id: 'ancestries',
    label: 'Народы и наследия',
    file: 'src/games/pathfinder2/Rules/ancestries.json',
    requiredFor: ['level-1'],
  },
  {
    id: 'backgrounds',
    label: 'Предыстории',
    file: 'src/games/pathfinder2/Rules/backgrounds.json',
    requiredFor: ['level-1'],
  },
  {
    id: 'classes',
    label: 'Классы и начальные особенности',
    file: 'src/games/pathfinder2/Rules/classes.json',
    requiredFor: ['level-1', 'progression'],
  },
  {
    id: 'general-feats',
    label: 'Общие, навыковые и мифические черты',
    file: 'src/games/pathfinder2/Rules/feats.json',
    requiredFor: ['feats', 'progression'],
  },
  {
    id: 'ancestry-feats',
    label: 'Черты народов',
    file: null,
    requiredFor: ['level-1', 'feats', 'progression'],
  },
  {
    id: 'class-feats',
    label: 'Классовые черты',
    file: null,
    requiredFor: ['level-1', 'feats', 'progression'],
  },
  {
    id: 'class-progression',
    label: 'Прогрессия классов 1–20',
    file: null,
    requiredFor: ['progression'],
  },
  {
    id: 'archetypes',
    label: 'Архетипы',
    file: 'src/games/pathfinder2/Rules/archetypes.json',
    requiredFor: ['feats', 'progression'],
  },
  {
    id: 'equipment',
    label: 'Снаряжение',
    file: 'src/games/pathfinder2/Rules/*.json (item catalogs)',
    requiredFor: ['equipment'],
  },
  {
    id: 'weapons',
    label: 'Оружие',
    file: 'src/games/pathfinder2/Rules/weapons.json',
    requiredFor: ['equipment'],
  },
  {
    id: 'armor',
    label: 'Броня',
    file: 'src/games/pathfinder2/Rules/armor.json',
    requiredFor: ['equipment'],
  },
  {
    id: 'shields',
    label: 'Щиты',
    file: 'src/games/pathfinder2/Rules/shields.json',
    requiredFor: ['equipment'],
  },
  {
    id: 'spells',
    label: 'Заклинания',
    file: 'src/games/pathfinder2/Rules/spells.json',
    requiredFor: ['spellcasting', 'progression'],
  },
  {
    id: 'deities',
    label: 'Божества',
    file: null,
    requiredFor: ['details'],
  },
  {
    id: 'languages',
    label: 'Языки',
    file: null,
    requiredFor: ['level-1', 'details'],
  },
  {
    id: 'traits',
    label: 'Структурированные traits',
    file: null,
    requiredFor: ['feats', 'equipment', 'spellcasting'],
  },
]

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function arrayAt(value: unknown, ...path: string[]) {
  let current: unknown = value
  for (const key of path) {
    if (!isRecord(current)) return []
    current = current[key]
  }
  return Array.isArray(current) ? current : []
}

function uniqueIdIssues(entries: unknown[], label: string) {
  const issues: string[] = []
  const seen = new Set<string>()
  entries.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) {
      issues.push(`${label}: у записи ${index + 1} нет стабильного id.`)
      return
    }
    if (seen.has(entry.id)) {
      issues.push(`${label}: id «${entry.id}» повторяется.`)
    }
    seen.add(entry.id)
  })
  if (issues.length <= 20) return issues
  return [
    ...issues.slice(0, 20),
    `${label}: ещё ${issues.length - 20} проблем со стабильными id.`,
  ]
}

function availability(
  id: Pathfinder2CatalogId,
  status: Pathfinder2CatalogAvailability['status'],
  entryCount: number,
  issues: string[] = [],
) {
  const seed = CATALOG_REQUIREMENTS.find(entry => entry.id === id)
  if (!seed) throw new Error(`Unknown Pathfinder 2 catalog: ${id}`)
  return { ...seed, status, entryCount, issues }
}

export function auditPathfinder2RuleDocuments(
  documents: Pathfinder2RuleDocumentsForAudit,
): Pathfinder2CatalogAvailability[] {
  const ancestries = arrayAt(documents.ancestries, 'ancestries')
  const versatileHeritages = arrayAt(documents.ancestries, 'versatileHeritages')
  const backgrounds = arrayAt(documents.backgrounds, 'backgrounds')
  const classes = arrayAt(documents.classes, 'classes')
  const generalFeats = arrayAt(documents.feats, 'feats', 'general')
  const skillFeats = arrayAt(documents.feats, 'feats', 'skill')
  const mythicFeats = arrayAt(documents.feats, 'feats', 'mythic')
  const allArchetypes = arrayAt(documents.archetypes, 'archetypes', 'all-archetypes')
  const spells = arrayAt(documents.spells, 'spells')
  const cantrips = arrayAt(documents.spells, 'cantrips')
  const armor = arrayAt(documents.armor, 'armor')
  const weapons = arrayAt(documents.weapons, 'weapons')
  const shields = arrayAt(documents.shields, 'items')
  const equipmentGroups = (documents.equipment ?? []).flatMap(document => [
    ...arrayAt(document, 'items'),
    ...arrayAt(document, 'wornItems'),
    ...arrayAt(document, 'wands'),
    ...arrayAt(document, 'artifacts'),
    ...arrayAt(document, 'materials'),
    ...arrayAt(document, 'snares'),
    ...arrayAt(document, 'contracts'),
    ...arrayAt(document, 'customizations'),
    ...arrayAt(document, 'consumables'),
    ...arrayAt(document, 'relics'),
    ...arrayAt(document, 'runes'),
    ...arrayAt(document, 'siegeWeapons'),
    ...arrayAt(document, 'spellhearts'),
    ...arrayAt(document, 'staves'),
  ])

  const ancestryIssues = [
    ...uniqueIdIssues(ancestries, 'Народы'),
    ...uniqueIdIssues(versatileHeritages, 'Универсальные наследия'),
  ]
  const backgroundIssues = uniqueIdIssues(backgrounds, 'Предыстории')
  const classIssues = uniqueIdIssues(classes, 'Классы')
  const featIssues = [
    ...uniqueIdIssues(generalFeats, 'Общие черты'),
    ...uniqueIdIssues(skillFeats, 'Черты навыков'),
    ...uniqueIdIssues(mythicFeats, 'Мифические черты'),
  ]
  const archetypeIssues = uniqueIdIssues(allArchetypes, 'Архетипы')
  const spellIssues = [
    ...uniqueIdIssues(spells, 'Заклинания'),
    ...uniqueIdIssues(cantrips, 'Фокусы'),
  ]
  const armorIssues = uniqueIdIssues(armor, 'Броня')
  const weaponIssues = uniqueIdIssues(weapons, 'Оружие')
  const shieldIssues = uniqueIdIssues(shields, 'Щиты')
  const equipmentIssues = uniqueIdIssues(equipmentGroups, 'Предметы')

  return [
    availability(
      'ancestries',
      ancestryIssues.length ? 'invalid' : 'connected',
      ancestries.length + versatileHeritages.length,
      ancestryIssues,
    ),
    availability(
      'backgrounds',
      backgroundIssues.length ? 'invalid' : 'connected',
      backgrounds.length,
      backgroundIssues,
    ),
    availability(
      'classes',
      classIssues.length ? 'invalid' : 'connected',
      classes.length,
      classIssues,
    ),
    availability(
      'general-feats',
      featIssues.length ? 'invalid' : 'partial',
      generalFeats.length + skillFeats.length + mythicFeats.length,
      featIssues.length ? featIssues : [
        'Prerequisites остаются текстом; каталог не содержит ancestry/class feats.',
      ],
    ),
    availability('ancestry-feats', 'missing', 0, [
      'Нужен авторизованный ancestry-feats catalog со стабильными ID и требованиями.',
    ]),
    availability('class-feats', 'missing', 0, [
      'Нужен авторизованный class-feats catalog со стабильными ID и требованиями.',
    ]),
    availability('class-progression', 'missing', 0, [
      'Нужна структурированная прогрессия каждого класса с 1-го по 20-й уровень.',
    ]),
    availability(
      'archetypes',
      archetypeIssues.length
        ? 'invalid'
        : allArchetypes.length
          ? 'available-not-connected'
          : 'missing',
      allArchetypes.length,
      archetypeIssues.length ? archetypeIssues : allArchetypes.length ? [
        'Файл присутствует, но текущий rules-data adapter его не подключает.',
      ] : ['Авторизованный каталог архетипов не найден.'],
    ),
    availability(
      'equipment',
      equipmentIssues.length
        ? 'invalid'
        : equipmentGroups.length
          ? 'available-not-connected'
          : 'missing',
      equipmentGroups.length,
      equipmentIssues.length ? equipmentIssues : equipmentGroups.length ? [
        'Описательные файлы присутствуют, но цена и Bulk не представлены структурированными полями.',
      ] : ['Нужен каталог предметов с ценой в целых монетах, Bulk, уровнем и traits.'],
    ),
    availability(
      'weapons',
      weaponIssues.length
        ? 'invalid'
        : weapons.length
          ? 'available-not-connected'
          : 'missing',
      weapons.length,
      weaponIssues.length ? weaponIssues : weapons.length ? [
        'Файл оружия присутствует, но цена, Bulk, урон, группа, владение, дальность и traits находятся только в описании.',
      ] : ['Нужны структурированные урон, группа, категория владения, дальность и traits.'],
    ),
    availability(
      'armor',
      armorIssues.length
        ? 'invalid'
        : armor.length
          ? 'available-not-connected'
          : 'missing',
      armor.length,
      armorIssues.length ? armorIssues : armor.length ? [
        'Файл брони присутствует, но цена, Bulk, AC, Dex cap и штрафы находятся только в описании.',
      ] : ['Нужны бонус КБ, Dex cap, штрафы, требование Силы, Bulk и группа.'],
    ),
    availability(
      'shields',
      shieldIssues.length
        ? 'invalid'
        : shields.length
          ? 'available-not-connected'
          : 'missing',
      shields.length,
      shieldIssues.length ? shieldIssues : shields.length ? [
        'Файл щитов присутствует, но цена, Bulk, бонус КБ, Hardness, HP/BT и действия находятся только в описании.',
      ] : ['Нужны бонус КБ, Hardness, HP/BT, Bulk и действия щита.'],
    ),
    availability(
      'spells',
      spellIssues.length
        ? 'invalid'
        : spells.length + cantrips.length
          ? 'connected'
          : 'missing',
      spells.length + cantrips.length,
      spellIssues.length ? spellIssues : spells.length + cantrips.length
        ? []
        : ['Авторизованный каталог заклинаний не найден.'],
    ),
    availability('deities', 'missing', 0, [
      'Нужны наказы, табу, domains, навык, оружие и варианты sanctification.',
    ]),
    availability('languages', 'missing', 0, [
      'Нужны стабильные LanguageId, редкость и правила доступа.',
    ]),
    availability('traits', 'missing', 0, [
      'Traits встречаются в данных, но нет единого каталога и машинных эффектов.',
    ]),
  ]
}

export function getUnavailablePathfinder2Catalogs(
  availability: Pathfinder2CatalogAvailability[],
) {
  return availability.filter(entry => entry.status !== 'connected')
}
