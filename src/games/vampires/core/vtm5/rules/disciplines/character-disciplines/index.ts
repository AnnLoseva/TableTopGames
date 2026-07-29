type JsonObject = Record<string, unknown>

export type NormalizedDisciplineSources = Record<string, number>
export type NormalizedDisciplines = Record<string, NormalizedDisciplineSources>
export type NormalizedDisciplinePowers = Record<string, string[]>
export type NormalizedDisciplinePathPowers = Record<string, Record<string, string[]>>

export type NormalizedCharacterDisciplines = {
  disciplines: NormalizedDisciplines
  powers: NormalizedDisciplinePowers
  pathPowers: NormalizedDisciplinePathPowers
}

const RATING_KEYS = new Set(['rating', 'dots', 'value'])
const POWER_NAME_KEYS = ['name', 'power', 'название']
const PATH_NAME_KEYS = ['path', 'pathName', 'path_name', 'путь']
const POWER_CONTAINER_KEYS = new Set(['powers', 'selectedPowers', 'selected_powers'])

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function toRating(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const rating = Number(value)
  return Number.isFinite(rating) ? Math.max(0, Math.floor(rating)) : null
}

function getPowerName(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!isObject(value)) return ''

  for (const key of POWER_NAME_KEYS) {
    if (typeof value[key] === 'string') return value[key].trim()
  }
  return ''
}

function getPathName(value: unknown): string {
  if (!isObject(value)) return ''

  for (const key of PATH_NAME_KEYS) {
    if (typeof value[key] === 'string') return value[key].trim()
  }
  return ''
}

function addPower(
  powers: NormalizedDisciplinePowers,
  disciplineName: string,
  value: unknown,
) {
  const name = getPowerName(value)
  if (!disciplineName || !name) return
  const current = powers[disciplineName] || []
  if (!current.includes(name)) powers[disciplineName] = [...current, name]
}

function addPathPower(
  pathPowers: NormalizedDisciplinePathPowers,
  disciplineName: string,
  pathName: string,
  value: unknown,
) {
  const name = getPowerName(value)
  const discipline = disciplineName.trim()
  const path = pathName.trim()
  if (!discipline || !path || !name) return

  const disciplinePaths = pathPowers[discipline] || {}
  const current = disciplinePaths[path] || []
  if (current.includes(name)) return
  pathPowers[discipline] = {
    ...disciplinePaths,
    [path]: [...current, name],
  }
}

function addPowerWithPath(
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  disciplineName: string,
  value: unknown,
  fallbackPath = '',
) {
  addPower(powers, disciplineName, value)
  const path = getPathName(value) || fallbackPath
  if (path) addPathPower(pathPowers, disciplineName, path, value)
}

function addPowerList(
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  disciplineName: string,
  value: unknown,
  fallbackPath = '',
) {
  if (!Array.isArray(value)) return
  value.forEach((power) => addPowerWithPath(
    powers,
    pathPowers,
    disciplineName,
    power,
    fallbackPath,
  ))
}

function getRatingFromRecord(value: JsonObject): number | null {
  for (const key of RATING_KEYS) {
    const rating = toRating(value[key])
    if (rating !== null) return rating
  }
  return null
}

function normalizeSources(value: unknown): NormalizedDisciplineSources {
  const directRating = toRating(value)
  if (directRating !== null) return { rating: directRating }
  if (!isObject(value)) return {}

  const sources: NormalizedDisciplineSources = {}

  if (isObject(value.sources)) {
    Object.entries(value.sources).forEach(([key, sourceValue]) => {
      const rating = toRating(sourceValue)
      if (rating !== null) sources[key] = rating
    })
  }

  const rating = getRatingFromRecord(value)
  if (rating !== null) sources.rating = rating

  if (isObject(value.paths)) {
    Object.entries(value.paths).forEach(([pathName, pathValue]) => {
      const pathRating = toRating(pathValue)
        ?? (isObject(pathValue) ? getRatingFromRecord(pathValue) : null)
      if (pathRating !== null) sources[pathName] = pathRating
    })
  }

  Object.entries(value).forEach(([key, sourceValue]) => {
    if (
      RATING_KEYS.has(key)
      || key === 'sources'
      || key === 'paths'
      || POWER_CONTAINER_KEYS.has(key)
    ) return
    const rating = toRating(sourceValue)
    if (rating !== null) sources[key] = rating
  })

  return sources
}

function normalizePathPowerValue(
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  disciplineName: string,
  value: unknown,
) {
  if (!isObject(value)) return

  Object.entries(value).forEach(([pathName, pathValue]) => {
    if (Array.isArray(pathValue)) {
      addPowerList(powers, pathPowers, disciplineName, pathValue, pathName)
      return
    }

    if (!isObject(pathValue)) return
    POWER_CONTAINER_KEYS.forEach((key) => {
      addPowerList(powers, pathPowers, disciplineName, pathValue[key], pathName)
    })
  })
}

function normalizePowerSelectionValue(
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  disciplineName: string,
  value: unknown,
) {
  if (Array.isArray(value)) {
    addPowerList(powers, pathPowers, disciplineName, value)
    return
  }

  if (!isObject(value)) return

  POWER_CONTAINER_KEYS.forEach((key) => {
    addPowerList(powers, pathPowers, disciplineName, value[key])
  })
  normalizePathPowerValue(powers, pathPowers, disciplineName, value.paths)

  Object.entries(value).forEach(([pathName, pathValue]) => {
    if (
      pathName === 'paths'
      || pathName === 'sources'
      || RATING_KEYS.has(pathName)
      || POWER_CONTAINER_KEYS.has(pathName)
    ) return
    if (Array.isArray(pathValue)) {
      addPowerList(powers, pathPowers, disciplineName, pathValue, pathName)
      return
    }
    if (isObject(pathValue)) {
      POWER_CONTAINER_KEYS.forEach((key) => {
        addPowerList(powers, pathPowers, disciplineName, pathValue[key], pathName)
      })
    }
  })
}

function normalizeDisciplineRecord(
  disciplines: NormalizedDisciplines,
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  disciplineName: string,
  value: unknown,
) {
  const name = disciplineName.trim()
  if (!name) return
  disciplines[name] = normalizeSources(value)
  if (isObject(value)) {
    normalizePowerSelectionValue(powers, pathPowers, name, value.powers)
    normalizePowerSelectionValue(powers, pathPowers, name, value.selectedPowers)
    normalizePathPowerValue(powers, pathPowers, name, value.paths)
  }
}

function normalizeDisciplinesValue(
  disciplines: NormalizedDisciplines,
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  value: unknown,
) {
  if (Array.isArray(value)) {
    value.forEach((discipline) => {
      if (!isObject(discipline)) return
      const name = getPowerName(discipline.discipline ?? discipline)
      if (!name) return
      normalizeDisciplineRecord(disciplines, powers, pathPowers, name, discipline)
    })
    return
  }

  if (!isObject(value)) return
  Object.entries(value).forEach(([name, discipline]) => {
    normalizeDisciplineRecord(disciplines, powers, pathPowers, name, discipline)
  })
}

function normalizeSeparatePowers(
  powers: NormalizedDisciplinePowers,
  pathPowers: NormalizedDisciplinePathPowers,
  value: unknown,
) {
  if (Array.isArray(value)) {
    value.forEach((power) => {
      if (!isObject(power)) return
      const disciplineNameValue = power.discipline
        ?? power.disciplineName
        ?? power.discipline_name
      const disciplineName = typeof disciplineNameValue === 'string'
        ? disciplineNameValue.trim()
        : ''
      addPowerWithPath(powers, pathPowers, disciplineName, power)
    })
    return
  }

  if (!isObject(value)) return
  Object.entries(value).forEach(([disciplineName, disciplinePowers]) => {
    normalizePowerSelectionValue(
      powers,
      pathPowers,
      disciplineName,
      disciplinePowers,
    )
  })
}

export function normalizeCharacterDisciplines(
  characterData: unknown,
): NormalizedCharacterDisciplines {
  const root = isObject(characterData) ? characterData : {}
  const data = isObject(root.data) ? root.data : root
  const disciplines: NormalizedDisciplines = {}
  const powers: NormalizedDisciplinePowers = {}
  const pathPowers: NormalizedDisciplinePathPowers = {}

  normalizeDisciplinesValue(disciplines, powers, pathPowers, data.disciplines)
  normalizeSeparatePowers(powers, pathPowers, data.selectedPowers)
  normalizeSeparatePowers(powers, pathPowers, data.powers)

  Object.keys(powers).forEach((disciplineName) => {
    if (!disciplines[disciplineName]) disciplines[disciplineName] = {}
  })
  Object.keys(pathPowers).forEach((disciplineName) => {
    if (!disciplines[disciplineName]) disciplines[disciplineName] = {}
  })

  return { disciplines, powers, pathPowers }
}
