import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type {
  RulesCatalogGame,
  RulesCatalogManifest,
} from '../src/platform/rules/catalog-manifest'

const PROJECT_DIR = process.cwd()
const PUBLIC_RULES_DIR = resolve(PROJECT_DIR, 'public/rules')
const DEFAULT_SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
const publishKey = process.env.SUPABASE_RULES_PUBLISH_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!publishKey) {
  throw new Error(
    'Set SUPABASE_RULES_PUBLISH_KEY or SUPABASE_SERVICE_ROLE_KEY before publishing.',
  )
}

const supabase = createClient(SUPABASE_URL, publishKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

async function readManifest(game: RulesCatalogGame) {
  const manifestPath = resolve(PUBLIC_RULES_DIR, game, 'manifest.json')
  const text = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(text) as RulesCatalogManifest
  if (manifest.schemaVersion !== 1 || manifest.game !== game) {
    throw new Error(`Invalid generated manifest for ${game}.`)
  }
  return { text, manifest }
}

async function upload(
  bucket: string,
  path: string,
  body: Uint8Array | string,
  cacheControl: string,
) {
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    cacheControl,
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new Error(`${bucket}/${path}: ${error.message}`)
}

async function verifyPublicObject(
  bucket: string,
  path: string,
  expectedSha256: string,
) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}?verify=${expectedSha256}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Verification failed for ${bucket}/${path}: HTTP ${response.status}.`)
  }
  const body = new Uint8Array(await response.arrayBuffer())
  if (sha256(body) !== expectedSha256) {
    throw new Error(`Verification checksum mismatch for ${bucket}/${path}.`)
  }
}

async function publishGame(game: RulesCatalogGame) {
  const bucket = `rules-${game}`
  const { text: manifestText, manifest } = await readManifest(game)

  for (const file of Object.values(manifest.files)) {
    const body = await readFile(resolve(PUBLIC_RULES_DIR, game, file.path))
    if (body.byteLength !== file.bytes || sha256(body) !== file.sha256) {
      throw new Error(`Generated file ${game}/${file.path} does not match its manifest.`)
    }
    await upload(bucket, file.path, body, '31536000')
    await verifyPublicObject(bucket, file.path, file.sha256)
  }

  await upload(bucket, 'manifest.json', manifestText, '300')
  await verifyPublicObject(
    bucket,
    'manifest.json',
    sha256(new TextEncoder().encode(manifestText)),
  )
  console.log(`${game}: published and verified ${manifest.release}`)
}

function isRulesCatalogGame(value: string): value is RulesCatalogGame {
  return value === 'pathfinder2' || value === 'vampires'
}

async function main() {
  const selectedGame = process.env.RULES_CATALOG_GAME
  let games: RulesCatalogGame[] = ['pathfinder2', 'vampires']
  if (selectedGame) {
    if (!isRulesCatalogGame(selectedGame)) {
      throw new Error(`Unknown RULES_CATALOG_GAME: ${selectedGame}`)
    }
    games = [selectedGame]
  }
  for (const game of games) await publishGame(game)
}

void main()
