import type { ComponentType } from 'react'
import type { Module } from '@/core/hub'
import type {
  MasterCommandProvider,
  MasterSearchProvider,
} from './search/types'

export type MasterConsoleModule = Module<'master-console', 'vtm5'>

export type MasterConsoleRouteState =
  | { status: 'loading' }
  | { status: 'invalid-room'; message: string }
  | { status: 'auth-required'; room: string }
  | { status: 'access-denied'; room: string }
  | { status: 'access-error'; room: string; message: string }
  | { status: 'locked'; room: string; denied: boolean }
  | { status: 'ready'; room: string }

/** Request from a master module into the shared right-rail roller. */
export type MasterRollRequest = {
  source: string
  actorId: string
  displayName: string
  hunger: number
  characterId: string | null
  traits: readonly string[]
  dice: number
  mode: 'pool' | 'rouse'
}

export type MasterModuleProps = {
  room: string
  role: 'master' | 'observer'
  instanceId?: string
  deepLinkParams?: Readonly<Record<string, string>>
  /** When deep-linked entity id is set but module could not resolve it. */
  entityMissing?: boolean
  onRequestRoll?: (request: MasterRollRequest) => void
}

export type MasterExportProvider = {
  id: string
  export: (options?: { includeSecrets?: boolean }) => Promise<unknown>
}

/**
 * UI contribution contract for master-console modules.
 * Lives here (not in core/hub): loader/sizes/export are React shell concerns.
 *
 * Search: export `searchProvider` and/or `searchProviders` — shell fans out only.
 * No giant global hook that knows all tables.
 */
export type MasterConsoleContribution = {
  id: string
  title: string
  shortTitle?: string
  icon: string
  order: number
  supportedSystems: readonly string[]
  allowedRoles: readonly ('master' | 'observer')[]
  defaultSize: { width: number; height: number }
  minSize?: { width: number; height: number }
  singleton?: boolean
  detachable?: boolean
  loader: () => Promise<{ default: ComponentType<MasterModuleProps> }>
  searchProvider?: MasterSearchProvider
  /** Prefer this when a module owns multiple entity indexes (e.g. scenes + layers). */
  searchProviders?: readonly MasterSearchProvider[]
  commandProvider?: MasterCommandProvider
  exportProvider?: MasterExportProvider
  /** Legacy module-specific deep-link keys; unified format uses `entity`. */
  deepLinks?: readonly string[]
}

// Re-export search contracts for module authors
export type {
  MasterSearchProvider,
  MasterCommandProvider,
  MasterSearchHit,
  MasterCommand,
} from './search/types'
