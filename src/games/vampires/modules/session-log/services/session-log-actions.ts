import { appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import { createEntityLink } from '@/games/vampires/modules/lore/api/links-api'
import { upsertLoreEntry } from '@/games/vampires/modules/lore/api/lore-api'
import type { LoreEntry } from '@/games/vampires/modules/lore/types'
import {
  archiveSessionLogEntry,
  createSessionLogEntry,
  publishSessionLogEntry,
  unpublishSessionLogEntry,
} from '../api'
import type { SessionLogEntry } from '../types'

export async function duplicateSessionLogEntry(entry: SessionLogEntry): Promise<SessionLogEntry> {
  const now = new Date().toISOString()
  const copy: SessionLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    title: `${entry.title || 'Запись'} (копия)`,
    status: 'draft',
    visibility: 'private',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  const result = await createSessionLogEntry(copy)
  if (!result.ok) throw new Error(result.conflict ? 'conflict' : result.error)
  return result.entry
}

export async function publishEntryWithLog(entry: SessionLogEntry): Promise<SessionLogEntry> {
  const published = await publishSessionLogEntry(entry)
  try {
    await appendMasterActionLog({
      chronicleId: entry.chronicleId,
      room: entry.room,
      sessionId: entry.sessionId,
      actionType: 'session_log.publish',
      actorType: 'master',
      actorId: 'self',
      summary: `Опубликован журнал: ${published.title || published.id.slice(0, 8)}`,
      payload: {
        entryId: published.id,
        version: published.version,
        visibility: published.visibility,
      },
      inversePayload: null,
      visibility: 'master',
    })
  } catch {
    // optional
  }
  return published
}

export async function makePrivateWithLog(entry: SessionLogEntry): Promise<SessionLogEntry> {
  const next = await unpublishSessionLogEntry(entry)
  try {
    await appendMasterActionLog({
      chronicleId: entry.chronicleId,
      room: entry.room,
      sessionId: entry.sessionId,
      actionType: 'session_log.unpublish',
      actorType: 'master',
      actorId: 'self',
      summary: `Журнал снова приватный: ${next.title || next.id.slice(0, 8)}`,
      payload: { entryId: next.id },
      inversePayload: null,
      visibility: 'master',
    })
  } catch {
    // optional
  }
  return next
}

export async function archiveEntryWithLog(entry: SessionLogEntry): Promise<SessionLogEntry> {
  const next = await archiveSessionLogEntry(entry)
  try {
    await appendMasterActionLog({
      chronicleId: entry.chronicleId,
      room: entry.room,
      sessionId: entry.sessionId,
      actionType: 'session_log.archive',
      actorType: 'master',
      actorId: 'self',
      summary: `Архив журнала: ${next.title || next.id.slice(0, 8)}`,
      payload: { entryId: next.id },
      inversePayload: null,
      visibility: 'master',
    })
  } catch {
    // optional
  }
  return next
}

export async function attachEntityToEntry(input: {
  entry: SessionLogEntry
  targetType: string
  targetId: string
  label: string
}): Promise<void> {
  await createEntityLink({
    chronicleId: input.entry.chronicleId,
    room: input.entry.room,
    sourceType: 'session_log_entry',
    sourceId: input.entry.id,
    targetType: input.targetType,
    targetId: input.targetId,
    relationType: 'mentions',
    label: input.label,
    visibility: 'master',
  })
}

export async function createPlotHookFromEntry(entry: SessionLogEntry): Promise<LoreEntry> {
  const loreEntry: LoreEntry = {
    id: crypto.randomUUID(),
    chronicleId: entry.chronicleId,
    room: entry.room,
    categoryId: null,
    categorySlug: 'plots',
    title: entry.title || 'Крюк из журнала',
    shortSummary: 'Создано из журнала сессии',
    bodyHtml: entry.bodyHtml || `<p>${entry.title}</p>`,
    tags: ['from-session-log', ...entry.tags].slice(0, 48),
    visibility: 'master',
    status: 'draft',
    attachments: [],
    privateNote: '',
    createdBy: entry.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await upsertLoreEntry(loreEntry)
  await attachEntityToEntry({
    entry,
    targetType: 'lore_entry',
    targetId: loreEntry.id,
    label: `✎ ${loreEntry.title}`,
  })
  return loreEntry
}

export async function addEntryToTimeline(entry: SessionLogEntry): Promise<void> {
  await appendMasterActionLog({
    chronicleId: entry.chronicleId,
    room: entry.room,
    sessionId: entry.sessionId,
    actionType: 'session_log.timeline',
    actorType: 'master',
    actorId: 'self',
    summary: entry.title || 'Запись журнала',
    payload: {
      entryId: entry.id,
      consequence: entry.title || 'Запись журнала',
      bodyPreview: bodyPreviewText(entry.bodyHtml),
    },
    inversePayload: null,
    visibility: 'master',
  })
}

// helper for type-only strip — avoid TS error by not using fake method
export function bodyPreviewText(html: string, max = 200): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}
