import type { Pathfinder2CatalogId } from '../types'

type UnknownRecord = Record<string, unknown>

export type Pathfinder2CatalogDocumentV1<Entry> = {
  schemaVersion: 1
  id: Pathfinder2CatalogId
  title: string
  version: string
  source: string
  license: string | null
  entries: Entry[]
}

export type Pathfinder2CatalogDocumentIssue = {
  path: string
  message: string
}

export type Pathfinder2CatalogDocumentAdapterResult<Entry> = {
  status: 'connected' | 'missing' | 'invalid'
  document: Pathfinder2CatalogDocumentV1<Entry> | null
  issues: Pathfinder2CatalogDocumentIssue[]
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function adaptPathfinder2CatalogDocument<Entry extends {
  id: string
  name: string
}>(
  value: unknown,
  expectedId: Pathfinder2CatalogId,
  validateEntry?: (
    entry: UnknownRecord,
    index: number,
  ) => Pathfinder2CatalogDocumentIssue[],
): Pathfinder2CatalogDocumentAdapterResult<Entry> {
  if (value === null || value === undefined) {
    return {
      status: 'missing',
      document: null,
      issues: [{
        path: '$',
        message: `Справочник «${expectedId}» не подключён.`,
      }],
    }
  }
  if (!isRecord(value)) {
    return {
      status: 'invalid',
      document: null,
      issues: [{ path: '$', message: 'Корень справочника должен быть объектом.' }],
    }
  }

  const issues: Pathfinder2CatalogDocumentIssue[] = []
  if (value.schemaVersion !== 1) {
    issues.push({
      path: '$.schemaVersion',
      message: 'Ожидается schemaVersion: 1.',
    })
  }
  if (value.id !== expectedId) {
    issues.push({
      path: '$.id',
      message: `Ожидается идентификатор «${expectedId}».`,
    })
  }
  for (const field of ['title', 'version', 'source'] as const) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      issues.push({
        path: `$.${field}`,
        message: `Поле ${field} должно быть непустой строкой.`,
      })
    }
  }
  if (!Array.isArray(value.entries)) {
    issues.push({
      path: '$.entries',
      message: 'Поле entries должно быть массивом.',
    })
  }

  const rawEntries = Array.isArray(value.entries) ? value.entries : []
  const entries: Entry[] = []
  const seenIds = new Set<string>()
  rawEntries.forEach((rawEntry, index) => {
    const path = `$.entries[${index}]`
    if (!isRecord(rawEntry)) {
      issues.push({ path, message: 'Запись должна быть объектом.' })
      return
    }
    const id = typeof rawEntry.id === 'string' ? rawEntry.id.trim() : ''
    const name = typeof rawEntry.name === 'string' ? rawEntry.name.trim() : ''
    if (!id) issues.push({ path: `${path}.id`, message: 'Нужен стабильный id.' })
    if (!name) issues.push({ path: `${path}.name`, message: 'Нужно название.' })
    if (id && seenIds.has(id)) {
      issues.push({
        path: `${path}.id`,
        message: `Идентификатор «${id}» повторяется.`,
      })
    }
    if (id) seenIds.add(id)
    issues.push(...(validateEntry?.(rawEntry, index) ?? []))
    if (id && name) entries.push(rawEntry as Entry)
  })

  if (issues.length) {
    return { status: 'invalid', document: null, issues }
  }
  return {
    status: 'connected',
    document: {
      schemaVersion: 1,
      id: expectedId,
      title: value.title as string,
      version: value.version as string,
      source: value.source as string,
      license: typeof value.license === 'string' ? value.license : null,
      entries,
    },
    issues: [],
  }
}
