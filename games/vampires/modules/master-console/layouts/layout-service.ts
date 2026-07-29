import { createClient } from '@/games/vampires/lib/supabase'
import { fetchMasterLayouts, saveMasterLayout } from '../api'
import { MASTER_LAYOUTS } from '../persistence/constants'
import type { MasterLayout } from '../persistence/types'
import { mapMasterLayoutRow } from '../persistence/mappers'
import type { MasterLayoutRow } from '../persistence/types'
import { defaultLayoutState, migrateLayoutJson, type MasterLayoutState } from './layout-schema'

export type LayoutSaveConflict = {
  kind: 'conflict'
  local: MasterLayout
  remote: MasterLayout
  message: string
}

export type LayoutSaveResult =
  | { ok: true; layout: MasterLayout; source: 'remote' | 'local' }
  | { ok: false; conflict: LayoutSaveConflict }
  | { ok: false; error: string }

const LOCAL_KEY = (room: string) => `vtm-master-layouts:${room}`

function readLocal(room: string): MasterLayout[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as MasterLayout[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(room: string, layouts: MasterLayout[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_KEY(room), JSON.stringify(layouts))
}

export function getLayoutState(layout: MasterLayout): MasterLayoutState {
  return migrateLayoutJson(layout.layoutJson)
}

export async function listLayouts(room: string): Promise<{ layouts: MasterLayout[]; source: 'remote' | 'local' }> {
  try {
    const layouts = await fetchMasterLayouts(room)
    if (layouts.length === 0) {
      // Ensure a default exists only in local cache for empty chronicles
      const defaults = ensureDefaultLocal(room, layouts)
      return { layouts: defaults, source: 'remote' }
    }
    writeLocal(room, layouts)
    return { layouts, source: 'remote' }
  } catch {
    return { layouts: ensureDefaultLocal(room, readLocal(room)), source: 'local' }
  }
}

function ensureDefaultLocal(room: string, existing: MasterLayout[]): MasterLayout[] {
  if (existing.some(item => item.isDefault || item.name === 'default')) return existing
  const now = new Date().toISOString()
  const def: MasterLayout = {
    id: `local-default-${room}`,
    chronicleId: `local-${room}`,
    room,
    ownerId: 'local',
    name: 'default',
    layoutVersion: 1,
    layoutJson: defaultLayoutState() as unknown as Record<string, unknown>,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  }
  const next = [def, ...existing]
  writeLocal(room, next)
  return next
}

/**
 * Optimistic concurrency: baseVersion must match remote layout_version.
 * On conflict returns both copies so UI can "save as copy".
 */
export async function saveLayoutWithVersion(
  layout: MasterLayout,
  baseVersion: number,
): Promise<LayoutSaveResult> {
  const next: MasterLayout = {
    ...layout,
    layoutVersion: baseVersion + 1,
    updatedAt: new Date().toISOString(),
    layoutJson: migrateLayoutJson(layout.layoutJson) as unknown as Record<string, unknown>,
  }

  try {
    const client = createClient()
    const { data: existing, error: readError } = await client
      .from(MASTER_LAYOUTS)
      .select('id, chronicle_id, room, owner_id, name, layout_version, layout_json, is_default, created_at, updated_at')
      .eq('id', layout.id)
      .maybeSingle()
    if (readError) throw readError

    if (existing) {
      const remote = mapMasterLayoutRow(existing as MasterLayoutRow)
      if (remote.layoutVersion > baseVersion) {
        return {
          ok: false,
          conflict: {
            kind: 'conflict',
            local: next,
            remote,
            message: `Конфликт раскладки: remote v${remote.layoutVersion} > base v${baseVersion} (last writer wins only with explicit overwrite)`,
          },
        }
      }
    }

    await saveMasterLayout(next)
    const all = readLocal(layout.room).filter(item => item.id !== next.id)
    writeLocal(layout.room, [next, ...all])
    return { ok: true, layout: next, source: 'remote' }
  } catch (err) {
    const all = readLocal(layout.room)
    const local = all.find(item => item.id === layout.id)
    if (local && local.layoutVersion > baseVersion) {
      return {
        ok: false,
        conflict: {
          kind: 'conflict',
          local: next,
          remote: local,
          message: 'Конфликт localStorage layout version',
        },
      }
    }
    writeLocal(layout.room, [next, ...all.filter(item => item.id !== next.id)])
    return {
      ok: true,
      layout: next,
      source: 'local',
    }
  }
}

/** Save conflicted local state under a new id/name. */
export async function saveLayoutAsCopy(
  layout: MasterLayout,
  nameSuffix = ' (копия)',
): Promise<LayoutSaveResult> {
  const copy: MasterLayout = {
    ...layout,
    id: crypto.randomUUID(),
    name: `${layout.name || 'layout'}${nameSuffix}`.slice(0, 80),
    layoutVersion: 1,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return saveLayoutWithVersion(copy, 0)
}

export function findLayoutByNameOrId(
  layouts: readonly MasterLayout[],
  key: string | null | undefined,
): MasterLayout | null {
  if (!key) return null
  return layouts.find(item => item.id === key || item.name === key) || null
}
