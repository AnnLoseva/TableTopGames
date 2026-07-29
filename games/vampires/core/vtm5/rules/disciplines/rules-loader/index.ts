import type { DisciplinePowerMechanics } from '../schema'

type JsonObject = Record<string, unknown>

export type LoadedDisciplinePower = {
  discipline: string
  path?: string
  level: number
  name: string
  description?: string
  pool?: string
  cost?: string
  effect?: string
  duration?: string
  mechanics?: DisciplinePowerMechanics
  raw: JsonObject
}

export type LoadedDisciplinePath = {
  name: string
  description?: string
  powers: LoadedDisciplinePower[]
  raw: JsonObject
}

export type LoadedDisciplineRule = {
  name: string
  description?: string
  system?: JsonObject
  powers: LoadedDisciplinePower[]
  paths: Record<string, LoadedDisciplinePath>
  raw: JsonObject
}

export type LoadedDisciplineRules = Record<string, LoadedDisciplineRule>

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getPowerContainer(value: JsonObject) {
  if (isObject(value.powers)) return value.powers
  const levelEntries = Object.entries(value).filter(([key]) => (
    Number.isFinite(Number(key))
  ))
  return levelEntries.length > 0
    ? Object.fromEntries(levelEntries)
    : undefined
}

function loadPowers(
  discipline: string,
  path: string | undefined,
  value: unknown,
): LoadedDisciplinePower[] {
  if (!isObject(value)) return []

  return Object.entries(value).flatMap(([levelKey, levelPowers]) => {
    if (!isObject(levelPowers)) return []
    const level = Number(levelKey)
    if (!Number.isFinite(level)) return []

    return Object.entries(levelPowers).flatMap(([name, power]) => {
      if (!isObject(power)) return []
      return [{
        discipline,
        path,
        level,
        name,
        description: optionalString(power.description),
        pool: optionalString(power.pool),
        cost: optionalString(power.cost),
        effect: optionalString(power.effect),
        duration: optionalString(power.duration),
        mechanics: isObject(power.mechanics)
          ? power.mechanics as DisciplinePowerMechanics
          : undefined,
        raw: power,
      }]
    })
  })
}

export function loadDisciplineRules(rulesJson: unknown): LoadedDisciplineRules {
  if (!isObject(rulesJson)) return {}

  const source = isObject(rulesJson.disciplines)
    ? rulesJson.disciplines
    : rulesJson

  return Object.fromEntries(
    Object.entries(source).flatMap(([disciplineName, discipline]) => {
      if (!isObject(discipline)) return []

      const directPowers = loadPowers(
        disciplineName,
        undefined,
        discipline.powers,
      )
      const paths = isObject(discipline.paths)
        ? Object.fromEntries(
            Object.entries(discipline.paths).flatMap(([pathName, path]) => {
              if (!isObject(path)) return []
              const powers = getPowerContainer(path)
              return [[pathName, {
                name: pathName,
                description: optionalString(path.description),
                powers: loadPowers(disciplineName, pathName, powers),
                raw: path,
              } satisfies LoadedDisciplinePath]]
            }),
          )
        : {}
      const pathPowers = Object.values(paths).flatMap((path) => path.powers)

      return [[disciplineName, {
        name: disciplineName,
        description: optionalString(discipline.description),
        system: isObject(discipline.system) ? discipline.system : undefined,
        powers: [...directPowers, ...pathPowers],
        paths,
        raw: discipline,
      } satisfies LoadedDisciplineRule]]
    }),
  )
}
