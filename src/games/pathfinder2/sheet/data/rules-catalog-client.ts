import {
  loadVersionedRulesCatalog,
  type LoadedRulesCatalogFiles,
} from '@/platform/rules/catalog-manifest'
import type { Pathfinder2RulesCatalog } from '../types'

const REQUIRED_ARRAYS: Array<keyof Pathfinder2RulesCatalog> = [
  'ancestries',
  'versatileHeritages',
  'backgrounds',
  'classes',
  'generalFeats',
  'skillFeats',
  'mythicFeats',
  'ancestryFeats',
  'classFeats',
  'classProgression',
  'equipment',
  'weapons',
  'armor',
  'shields',
  'spells',
  'cantrips',
  'focusSpells',
  'languages',
  'deities',
  'traits',
  'sources',
  'dataAvailability',
  'validationWarnings',
]

export type LoadedPathfinder2RulesCatalog = {
  catalog: Pathfinder2RulesCatalog
  release: string
  source: LoadedRulesCatalogFiles['source']
}

let catalogPromise: Promise<LoadedPathfinder2RulesCatalog> | null = null

function assembleCatalog(files: Record<string, unknown>) {
  const catalog = Object.assign(
    {},
    ...Object.values(files).filter(value => (
      Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    )),
  ) as Partial<Pathfinder2RulesCatalog>

  const missing = REQUIRED_ARRAYS.filter(key => !Array.isArray(catalog[key]))
  if (missing.length > 0) {
    throw new Error(`В runtime-каталоге Pathfinder отсутствуют: ${missing.join(', ')}.`)
  }
  return catalog as Pathfinder2RulesCatalog
}

export function loadPathfinder2RulesCatalog() {
  if (!catalogPromise) {
    catalogPromise = loadVersionedRulesCatalog('pathfinder2', {
      pinRemoteToLocalRelease: true,
    }).then(result => ({
      catalog: assembleCatalog(result.files),
      release: result.manifest.release,
      source: result.source,
    }))
  }
  return catalogPromise
}

export function resetPathfinder2RulesCatalog() {
  catalogPromise = null
}
