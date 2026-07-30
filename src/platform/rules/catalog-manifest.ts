export type RulesCatalogGame = 'pathfinder2' | 'vampires'

export type RulesCatalogManifestFile = {
  path: string
  sha256: string
  bytes: number
}

export type RulesCatalogManifest = {
  schemaVersion: 1
  game: RulesCatalogGame
  release: string
  files: Record<string, RulesCatalogManifestFile>
}

export type LoadedRulesCatalogFiles = {
  manifest: RulesCatalogManifest
  files: Record<string, unknown>
  source: 'supabase' | 'local'
}

const DEFAULT_SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co'

function remoteManifestUrl(game: RulesCatalogGame) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/rules-${game}/manifest.json`
}

function localManifestUrl(game: RulesCatalogGame) {
  return `/rules/${game}/manifest.json`
}

function isRulesCatalogManifest(
  value: unknown,
  expectedGame: RulesCatalogGame,
): value is RulesCatalogManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const manifest = value as Partial<RulesCatalogManifest>
  if (
    manifest.schemaVersion !== 1
    || manifest.game !== expectedGame
    || typeof manifest.release !== 'string'
    || !manifest.release
    || !manifest.files
    || typeof manifest.files !== 'object'
    || Array.isArray(manifest.files)
  ) return false

  return Object.values(manifest.files).every(file => (
    Boolean(file)
    && typeof file.path === 'string'
    && /^[a-z0-9._/-]+$/i.test(file.path)
    && !file.path.startsWith('/')
    && !file.path.includes('..')
    && typeof file.sha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(file.sha256)
    && Number.isSafeInteger(file.bytes)
    && file.bytes > 0
  ))
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function fetchManifest(url: string, game: RulesCatalogGame) {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Manifest ${game} недоступен: HTTP ${response.status}.`)
  }
  const manifest = await response.json() as unknown
  if (!isRulesCatalogManifest(manifest, game)) {
    throw new Error(`Manifest ${game} имеет неизвестный формат.`)
  }
  return manifest
}

async function fetchReleaseFiles(
  manifestUrl: string,
  manifest: RulesCatalogManifest,
) {
  const absoluteManifestUrl = new URL(
    manifestUrl,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  )
  const entries = await Promise.all(
    Object.entries(manifest.files).map(async ([id, file]) => {
      const url = new URL(file.path, absoluteManifestUrl).toString()
      const response = await fetch(url, { cache: 'force-cache' })
      if (!response.ok) {
        throw new Error(`Файл каталога ${id} недоступен: HTTP ${response.status}.`)
      }
      const text = await response.text()
      if (byteLength(text) !== file.bytes) {
        throw new Error(`Размер файла каталога ${id} не совпадает с manifest.`)
      }
      if (await sha256(text) !== file.sha256) {
        throw new Error(`Контрольная сумма файла каталога ${id} не совпадает.`)
      }
      return [id, JSON.parse(text) as unknown] as const
    }),
  )
  return Object.fromEntries(entries)
}

function preferLocalCatalogs() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1'
}

export async function loadVersionedRulesCatalog(
  game: RulesCatalogGame,
): Promise<LoadedRulesCatalogFiles> {
  const candidates: Array<{
    url: string
    source: LoadedRulesCatalogFiles['source']
  }> = preferLocalCatalogs()
    ? [{ url: localManifestUrl(game), source: 'local' }]
    : [
        { url: remoteManifestUrl(game), source: 'supabase' },
        { url: localManifestUrl(game), source: 'local' },
      ]

  const errors: string[] = []
  for (const candidate of candidates) {
    try {
      const manifest = await fetchManifest(candidate.url, game)
      const files = await fetchReleaseFiles(candidate.url, manifest)
      return { manifest, files, source: candidate.source }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  throw new Error(`Каталог ${game} не загрузился. ${errors.join(' ')}`)
}
