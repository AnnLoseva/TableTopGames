import type { Module } from '@/core/hub'

export type SessionLogModule = Module<'session-log', 'vtm5'>

export type SessionLogVisibility = 'private' | 'shared_all' | 'shared_selected'
export type SessionLogStatus = 'draft' | 'published' | 'archived'
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'local'

export type SessionLogAttachment = {
  id: string
  kind: 'image' | 'file' | 'link'
  name: string
  url: string
}

/** Master draft row — never sent to player clients as-is. */
export type SessionLogEntry = {
  id: string
  chronicleId: string
  room: string
  sessionId: string | null
  title: string
  bodyHtml: string
  tags: string[]
  visibility: SessionLogVisibility
  status: SessionLogStatus
  sharedPlayerIds: string[]
  attachments: SessionLogAttachment[]
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Controlled player-readable projection. */
export type SessionLogPublished = {
  entryId: string
  chronicleId: string
  room: string
  sessionId: string | null
  title: string
  bodyHtml: string
  tags: string[]
  visibility: 'shared_all' | 'shared_selected'
  sharedPlayerIds: string[]
  publishedAt: string
  publishedVersion: number
}

export type SessionLogEntryRow = {
  id: string
  chronicle_id: string
  room: string
  session_id: string | null
  title: string
  body_html: string
  tags: string[] | null
  visibility: SessionLogVisibility
  status: SessionLogStatus
  shared_player_ids: string[] | null
  attachments: unknown
  version: number
  created_by: string
  created_at: string
  updated_at: string
}

export type SessionLogPublishedRow = {
  entry_id: string
  chronicle_id: string
  room: string
  session_id: string | null
  title: string
  body_html: string
  tags: string[] | null
  visibility: 'shared_all' | 'shared_selected'
  shared_player_ids: string[] | null
  published_at: string
  published_version: number
}

export type SessionLogListItem = {
  entry: SessionLogEntry
  isPublishedProjection: boolean
  sessionLabel: string
}
