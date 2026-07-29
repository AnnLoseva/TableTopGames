'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchChronicleSessions, getMasterMembership } from '@/games/vampires/modules/master-console/api'
import {
  fetchEntityLinksInvolving,
  linksToChips,
} from '@/games/vampires/modules/lore/api/links-api'
import type { EntityLinkChip } from '@/games/vampires/modules/lore/types'
import type { ChronicleSession } from '@/games/vampires/modules/master-console/persistence/types'
import {
  createSessionLogEntry,
  fetchMasterSessionLog,
  saveSessionLogEntry,
} from '../api'
import { AUTOSAVE_DEBOUNCE_MS } from '../constants'
import {
  archiveEntryWithLog,
  attachEntityToEntry,
  addEntryToTimeline,
  bodyPreviewText,
  createPlotHookFromEntry,
  duplicateSessionLogEntry,
  makePrivateWithLog,
  publishEntryWithLog,
} from '../services'
import type { SaveStatus, SessionLogEntry } from '../types'

export function useSessionLog(room: string) {
  const [entries, setEntries] = useState<SessionLogEntry[]>([])
  const [sessions, setSessions] = useState<ChronicleSession[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chronicleId, setChronicleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [source, setSource] = useState<'remote' | 'local'>('local')
  const [query, setQuery] = useState('')
  const [filterVisibility, setFilterVisibility] = useState<'all' | SessionLogEntry['visibility']>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | SessionLogEntry['status']>('all')
  const [linkChips, setLinkChips] = useState<EntityLinkChip[]>([])
  const [conflictRemote, setConflictRemote] = useState<SessionLogEntry | null>(null)

  const baseVersionRef = useRef<Map<string, number>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<SessionLogEntry | null>(null)

  const reload = useCallback(async () => {
    if (!room) return
    setLoading(true)
    try {
      const [log, membership, sessionRows] = await Promise.all([
        fetchMasterSessionLog(room),
        getMasterMembership(room).catch(() => null),
        fetchChronicleSessions(room).catch(() => [] as ChronicleSession[]),
      ])
      setEntries(log.entries)
      setSource(log.source)
      setSessions(sessionRows)
      if (membership) setChronicleId(membership.chronicleId)
      else if (log.entries[0]) setChronicleId(log.entries[0].chronicleId)
      log.entries.forEach(entry => baseVersionRef.current.set(entry.id, entry.version))
      setSelectedId(prev => {
        if (prev && log.entries.some(entry => entry.id === prev)) return prev
        return log.entries.find(entry => entry.status !== 'archived')?.id || log.entries[0]?.id || null
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить журнал')
    } finally {
      setLoading(false)
    }
  }, [room])

  useEffect(() => {
    void reload()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [reload])

  const selected = useMemo(
    () => entries.find(entry => entry.id === selectedId) || null,
    [entries, selectedId],
  )

  useEffect(() => {
    draftRef.current = selected
  }, [selected])

  useEffect(() => {
    if (!selected || !room) {
      setLinkChips([])
      return
    }
    let cancelled = false
    void fetchEntityLinksInvolving(room, 'session_log_entry', selected.id).then(links => {
      if (!cancelled) setLinkChips(linksToChips(links, 'session_log_entry', selected.id))
    })
    return () => {
      cancelled = true
    }
  }, [room, selected])

  const sessionLabel = useCallback((sessionId: string | null) => {
    if (!sessionId) return '—'
    const session = sessions.find(item => item.id === sessionId)
    if (!session) return sessionId.slice(0, 8)
    return `с.${session.sequenceNumber} · ночь ${session.nightNumber}`
  }, [sessions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(entry => {
      if (filterStatus !== 'all' && entry.status !== filterStatus) return false
      if (filterVisibility !== 'all' && entry.visibility !== filterVisibility) return false
      if (!q) return true
      const hay = `${entry.title} ${entry.bodyHtml} ${entry.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [entries, filterStatus, filterVisibility, query])

  const flushSave = useCallback(async (entry: SessionLogEntry) => {
    const base = baseVersionRef.current.get(entry.id) ?? entry.version
    setSaveStatus('saving')
    const result = await saveSessionLogEntry(entry, base)
    if (!result.ok) {
      if (result.conflict) {
        setConflictRemote(result.remote)
        setSaveStatus('conflict')
        setStatusMessage('Конфликт: запись изменена в другом окне')
        return
      }
      setSaveStatus('error')
      setStatusMessage(result.error)
      return
    }
    baseVersionRef.current.set(result.entry.id, result.entry.version)
    setEntries(prev => [result.entry, ...prev.filter(item => item.id !== result.entry.id)])
    setSaveStatus(result.source === 'local' ? 'local' : 'saved')
    setConflictRemote(null)
  }, [])

  const scheduleSave = useCallback((entry: SessionLogEntry) => {
    setEntries(prev => prev.map(item => (item.id === entry.id ? entry : item)))
    setSaveStatus('dirty')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void flushSave(entry)
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [flushSave])

  const patchSelected = useCallback((patch: Partial<SessionLogEntry>) => {
    if (!selected) return
    const next = {
      ...selected,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    draftRef.current = next
    scheduleSave(next)
  }, [scheduleSave, selected])

  const ensureChronicle = useCallback(() => {
    // Local fallback when Auth membership is not yet available.
    if (chronicleId) return chronicleId
    const fallback = `local-${room}`
    setChronicleId(fallback)
    return fallback
  }, [chronicleId, room])

  const createEntry = useCallback(async () => {
    const cid = ensureChronicle()
    const now = new Date().toISOString()
    const activeSession = sessions.find(session => session.status === 'active') || sessions[0]
    const entry: SessionLogEntry = {
      id: crypto.randomUUID(),
      chronicleId: cid,
      room,
      sessionId: activeSession?.id || null,
      title: 'Новая запись',
      bodyHtml: '',
      tags: [],
      visibility: 'private',
      status: 'draft',
      sharedPlayerIds: [],
      attachments: [],
      version: 1,
      createdBy: 'local',
      createdAt: now,
      updatedAt: now,
    }
    const result = await createSessionLogEntry(entry)
    if (!result.ok) {
      setStatusMessage(result.conflict ? 'conflict' : result.error)
      return
    }
    baseVersionRef.current.set(result.entry.id, result.entry.version)
    setEntries(prev => [result.entry, ...prev])
    setSelectedId(result.entry.id)
    setSaveStatus(result.source === 'local' ? 'local' : 'saved')
    setStatusMessage('Запись создана (private draft)')
  }, [ensureChronicle, room, sessions])

  const duplicateSelected = useCallback(async () => {
    if (!selected) return
    const copy = await duplicateSessionLogEntry(selected)
    baseVersionRef.current.set(copy.id, copy.version)
    setEntries(prev => [copy, ...prev])
    setSelectedId(copy.id)
    setStatusMessage('Копия создана')
  }, [selected])

  const publishSelected = useCallback(async () => {
    if (!selected) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      if (draftRef.current) await flushSave(draftRef.current)
    }
    const current = draftRef.current || selected
    // Ensure shared visibility for publish
    const ready = current.visibility === 'private'
      ? { ...current, visibility: 'shared_all' as const }
      : current
    const published = await publishEntryWithLog(ready)
    baseVersionRef.current.set(published.id, published.version)
    setEntries(prev => prev.map(item => (item.id === published.id ? published : item)))
    setSaveStatus('saved')
    setStatusMessage('Показано игрокам (отдельная published-проекция)')
  }, [flushSave, selected])

  const makePrivateSelected = useCallback(async () => {
    if (!selected) return
    const next = await makePrivateWithLog(selected)
    baseVersionRef.current.set(next.id, next.version)
    setEntries(prev => prev.map(item => (item.id === next.id ? next : item)))
    setStatusMessage('Снова приватно — published projection удалена')
  }, [selected])

  const archiveSelected = useCallback(async () => {
    if (!selected) return
    const next = await archiveEntryWithLog(selected)
    baseVersionRef.current.set(next.id, next.version)
    setEntries(prev => prev.map(item => (item.id === next.id ? next : item)))
    setStatusMessage('В архиве')
  }, [selected])

  const attachEntity = useCallback(async (targetType: string, targetId: string, label: string) => {
    if (!selected) return
    await attachEntityToEntry({ entry: selected, targetType, targetId, label })
    const links = await fetchEntityLinksInvolving(room, 'session_log_entry', selected.id)
    setLinkChips(linksToChips(links, 'session_log_entry', selected.id))
    setStatusMessage('Сущность прикреплена')
  }, [room, selected])

  const createHook = useCallback(async () => {
    if (!selected) return
    const lore = await createPlotHookFromEntry(selected)
    const links = await fetchEntityLinksInvolving(room, 'session_log_entry', selected.id)
    setLinkChips(linksToChips(links, 'session_log_entry', selected.id))
    setStatusMessage(`Крюк создан: ${lore.title}`)
  }, [room, selected])

  const addToTimeline = useCallback(async () => {
    if (!selected) return
    await addEntryToTimeline(selected)
    setStatusMessage('Добавлено в timeline (action log)')
  }, [selected])

  const resolveConflictKeepMine = useCallback(async () => {
    if (!selected || !conflictRemote) return
    // Force overwrite by basing on remote version
    baseVersionRef.current.set(selected.id, conflictRemote.version)
    await flushSave({ ...selected, version: conflictRemote.version })
  }, [conflictRemote, flushSave, selected])

  const resolveConflictTakeTheirs = useCallback(() => {
    if (!conflictRemote) return
    baseVersionRef.current.set(conflictRemote.id, conflictRemote.version)
    setEntries(prev => prev.map(item => (item.id === conflictRemote.id ? conflictRemote : item)))
    setConflictRemote(null)
    setSaveStatus('saved')
    setStatusMessage('Загружена версия из другого окна')
  }, [conflictRemote])

  return {
    entries,
    filtered,
    sessions,
    selected,
    selectedId,
    setSelectedId,
    loading,
    error,
    statusMessage,
    setStatusMessage,
    saveStatus,
    source,
    query,
    setQuery,
    filterVisibility,
    setFilterVisibility,
    filterStatus,
    setFilterStatus,
    linkChips,
    sessionLabel,
    chronicleId,
    setChronicleId,
    patchSelected,
    createEntry,
    duplicateSelected,
    publishSelected,
    makePrivateSelected,
    archiveSelected,
    attachEntity,
    createHook,
    addToTimeline,
    conflictRemote,
    resolveConflictKeepMine,
    resolveConflictTakeTheirs,
    reload,
    bodyPreviewText,
  }
}
