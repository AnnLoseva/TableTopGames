import type {
  Pathfinder2CatalogAvailability,
  Pathfinder2CatalogId,
} from '../types'
import { adaptPathfinder2CatalogDocument } from './catalog-document'

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
  ancestryFeats?: unknown
  classFeats?: unknown
  classProgression?: unknown
  normalizedEquipment?: unknown
  normalizedWeapons?: unknown
  normalizedArmor?: unknown
  normalizedShields?: unknown
  deities?: unknown
  languages?: unknown
  traits?: unknown
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
    file: 'src/games/pathfinder2/Rules/catalogs/ancestry-feats.json',
    requiredFor: ['level-1', 'feats', 'progression'],
  },
  {
    id: 'class-feats',
    label: 'Классовые черты',
    file: 'src/games/pathfinder2/Rules/catalogs/class-feats.json',
    requiredFor: ['level-1', 'feats', 'progression'],
  },
  {
    id: 'class-progression',
    label: 'Прогрессия классов 1–20',
    file: 'src/games/pathfinder2/Rules/catalogs/class-progression.json',
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
    file: 'src/games/pathfinder2/Rules/catalogs/equipment.json',
    requiredFor: ['equipment'],
  },
  {
    id: 'weapons',
    label: 'Оружие',
    file: 'src/games/pathfinder2/Rules/catalogs/weapons.json',
    requiredFor: ['equipment'],
  },
  {
    id: 'armor',
    label: 'Броня',
    file: 'src/games/pathfinder2/Rules/catalogs/armor.json',
    requiredFor: ['equipment'],
  },
  {
    id: 'shields',
    label: 'Щиты',
    file: 'src/games/pathfinder2/Rules/catalogs/shields.json',
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
    file: 'src/games/pathfinder2/Rules/catalogs/deities.json',
    requiredFor: ['details'],
  },
  {
    id: 'languages',
    label: 'Языки',
    file: 'src/games/pathfinder2/Rules/catalogs/languages.json',
    requiredFor: ['level-1', 'details'],
  },
  {
    id: 'traits',
    label: 'Структурированные traits',
    file: 'src/games/pathfinder2/Rules/catalogs/traits.json',
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

function canonicalAvailability(
  id: Pathfinder2CatalogId,
  document: unknown,
  countEntries: (entries: UnknownRecord[]) => number = entries => entries.length,
) {
  const result = adaptPathfinder2CatalogDocument<{
    id: string
    name: string
  }>(document, id)
  const entries = (result.document?.entries ?? []) as UnknownRecord[]
  return availability(
    id,
    result.status,
    countEntries(entries),
    result.issues.map(issue => `${issue.path}: ${issue.message}`),
  )
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
  const nestedArchetypes = arrayAt(documents.archetypes, 'archetypes', 'all-archetypes')
  const allArchetypes = nestedArchetypes.length
    ? nestedArchetypes
    : arrayAt(documents.archetypes, 'archetypes')
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
  const ancestryFeatAvailability = canonicalAvailability(
    'ancestry-feats',
    documents.ancestryFeats,
  )
  const classFeatAvailability = canonicalAvailability(
    'class-feats',
    documents.classFeats,
  )
  const classProgressionAvailability = canonicalAvailability(
    'class-progression',
    documents.classProgression,
    entries => entries.filter(entry => typeof entry.classId === 'string').length,
  )
  const normalizedEquipmentAvailability = canonicalAvailability(
    'equipment',
    documents.normalizedEquipment,
  )
  const normalizedWeaponAvailability = canonicalAvailability(
    'weapons',
    documents.normalizedWeapons,
  )
  const normalizedArmorAvailability = canonicalAvailability(
    'armor',
    documents.normalizedArmor,
  )
  const normalizedShieldAvailability = canonicalAvailability(
    'shields',
    documents.normalizedShields,
  )

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
        'Часть prerequisites остаётся текстом и требует ручной проверки.',
      ],
    ),
    ancestryFeatAvailability,
    classFeatAvailability,
    classProgressionAvailability,
    availability('archetypes', 'connected', allArchetypes.length, []),
    documents.normalizedEquipment === undefined
      ? availability(
          'equipment',
          equipmentIssues.length ? 'invalid' : 'available-not-connected',
          equipmentGroups.length,
          equipmentIssues,
        )
      : normalizedEquipmentAvailability,
    documents.normalizedWeapons === undefined
      ? availability(
          'weapons',
          weaponIssues.length ? 'invalid' : 'available-not-connected',
          weapons.length,
          weaponIssues,
        )
      : normalizedWeaponAvailability,
    documents.normalizedArmor === undefined
      ? availability(
          'armor',
          armorIssues.length ? 'invalid' : 'available-not-connected',
          armor.length,
          armorIssues,
        )
      : normalizedArmorAvailability,
    documents.normalizedShields === undefined
      ? availability(
          'shields',
          shieldIssues.length ? 'invalid' : 'available-not-connected',
          shields.length,
          shieldIssues,
        )
      : normalizedShieldAvailability,
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
    canonicalAvailability('deities', documents.deities),
    canonicalAvailability('languages', documents.languages),
    canonicalAvailability('traits', documents.traits),
  ]
}

export function getUnavailablePathfinder2Catalogs(
  availability: Pathfinder2CatalogAvailability[],
) {
  return availability.filter(entry => entry.status !== 'connected')
}
