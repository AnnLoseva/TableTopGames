'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSessionNotes, upsertSessionNote } from '../api'
import type { NotesSaveStatus, SessionNote } from '../types'

const DEBOUNCE_MS = 700

export function useSessionNotes(room: string, chronicleId: string) {
  const [note, setNote] = useState<SessionNote | null>(null)
  const [status, setStatus] = useState<NotesSaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef<SessionNote | null>(null)
  noteRef.current = note

  useEffect(() => {
    if (!room) return
    let cancelled = false
    void fetchSessionNotes(room).then(({ notes, source }) => {
      if (cancelled) return
      const primary = notes[0] || null
      if (primary) {
        setNote(primary)
        setStatus(source === 'local' ? 'local' : 'saved')
      } else if (chronicleId) {
        const created: SessionNote = {
          id: crypto.randomUUID(),
          chronicleId,
          room,
          sessionId: null,
          title: 'Заметки сессии',
          bodyHtml: '',
          entityType: '',
          entityId: '',
          visibility: 'master',
          createdBy: 'local',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setNote(created)
        setStatus('idle')
      }
    })
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [room, chronicleId])

  const flush = useCallback(async (next: SessionNote) => {
    setStatus('saving')
    try {
      const { source } = await upsertSessionNote({
        ...next,
        updatedAt: new Date().toISOString(),
      })
      setStatus(source === 'local' ? 'local' : 'saved')
      setError(null)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }, [])

  const updateBody = useCallback((bodyHtml: string) => {
    setNote(prev => {
      if (!prev) return prev
      const next = { ...prev, bodyHtml }
      setStatus('dirty')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void flush(next)
      }, DEBOUNCE_MS)
      return next
    })
  }, [flush])

  const updateEntityLink = useCallback((entityType: string, entityId: string) => {
    setNote(prev => {
      if (!prev) return prev
      const next = { ...prev, entityType, entityId }
      setStatus('dirty')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void flush(next)
      }, DEBOUNCE_MS)
      return next
    })
  }, [flush])

  const saveNow = useCallback(async () => {
    if (!noteRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    await flush(noteRef.current)
  }, [flush])

  return {
    note,
    status,
    error,
    updateBody,
    updateEntityLink,
    saveNow,
  }
}
