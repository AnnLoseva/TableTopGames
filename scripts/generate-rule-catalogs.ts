import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getPathfinder2RulesCatalog } from '../src/games/pathfinder2/sheet/rules-data-source'
import type {
  RulesCatalogGame,
  RulesCatalogManifest,
} from '../src/platform/rules/catalog-manifest'

const PROJECT_DIR = process.cwd()
const PUBLIC_RULES_DIR = resolve(PROJECT_DIR, 'public/rules')

function jsonText(value: unknown) {
  return `${JSON.stringify(value)}\n`
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function writeCatalogRelease(
  game: RulesCatalogGame,
  files: Record<string, unknown>,
) {
  const serialized = Object.fromEntries(
    Object.entries(files).map(([id, value]) => [id, jsonText(value)]),
  )
  const releaseHash = sha256(
    Object.entries(serialized)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => `${id}:${sha256(value)}`)
      .join('\n'),
  )
  const release = `sha256-${releaseHash.slice(0, 20)}`
  const outputDir = resolve(PUBLIC_RULES_DIR, game)
  const releaseDir = resolve(outputDir, 'releases', release)
  await mkdir(releaseDir, { recursive: true })

  const manifestFiles: RulesCatalogManifest['files'] = {}
  for (const [id, text] of Object.entries(serialized)) {
    const filename = `${id}.json`
    await writeFile(resolve(releaseDir, filename), text)
    manifestFiles[id] = {
      path: `releases/${release}/${filename}`,
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
    }
  }

  const manifest: RulesCatalogManifest = {
    schemaVersion: 1,
    game,
    release,
    files: manifestFiles,
  }
  await writeFile(resolve(outputDir, 'manifest.json'), jsonText(manifest))
  return manifest
}

async function generatePathfinder2Catalog() {
  const catalog = getPathfinder2RulesCatalog()
  const chunks = {
    core: {
      ancestries: catalog.ancestries,
      versatileHeritages: catalog.versatileHeritages,
      backgrounds: catalog.backgrounds,
      classes: catalog.classes,
      classProgression: catalog.classProgression,
      languages: catalog.languages,
      sources: catalog.sources,
      dataAvailability: catalog.dataAvailability,
      validationWarnings: catalog.validationWarnings,
    },
    'general-feats': { generalFeats: catalog.generalFeats },
    'skill-feats': { skillFeats: catalog.skillFeats },
    'special-feats': {
      mythicFeats: catalog.mythicFeats,
      ancestryFeats: catalog.ancestryFeats,
      classFeats: catalog.classFeats,
    },
    equipment: {
      equipment: catalog.equipment,
      weapons: catalog.weapons,
      armor: catalog.armor,
      shields: catalog.shields,
    },
    magic: {
      spells: catalog.spells,
      cantrips: catalog.cantrips,
      focusSpells: catalog.focusSpells,
      deities: catalog.deities,
      traits: catalog.traits,
    },
  }

  const assembledKeys = new Set(
    Object.values(chunks).flatMap(chunk => Object.keys(chunk)),
  )
  const missing = Object.keys(catalog).filter(key => !assembledKeys.has(key))
  if (missing.length > 0) {
    throw new Error(`Pathfinder runtime chunks omit catalog keys: ${missing.join(', ')}`)
  }
  return writeCatalogRelease('pathfinder2', chunks)
}

async function generateVampireCatalog() {
  const [ruText, enText] = await Promise.all([
    readFile(resolve(PROJECT_DIR, 'public/vampires/rules.json'), 'utf8'),
    readFile(resolve(PROJECT_DIR, 'public/vampires/rules_eng.json'), 'utf8'),
  ])
  return writeCatalogRelease('vampires', {
    ru: JSON.parse(ruText) as unknown,
    en: JSON.parse(enText) as unknown,
  })
}

async function main() {
  const [pathfinder2, vampires] = await Promise.all([
    generatePathfinder2Catalog(),
    generateVampireCatalog(),
  ])

  console.log(`Pathfinder 2 rules release: ${pathfinder2.release}`)
  console.log(`Vampire rules release: ${vampires.release}`)
}

void main()
