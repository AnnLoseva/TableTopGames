import { createClient } from '@/games/vampires/lib/supabase'
import { MASTER_SESSION_NOTES, NOTES_LOCAL_KEY } from '../constants'
import { mapSessionNoteRow, toSessionNoteRow } from '../mappers'
import type { SessionNote, SessionNoteRow } from '../types'

const NOTE_SELECT = 'id, chronicle_id, room, session_id, title, body_html, entity_type, entity_id, visibility, created_by, created_at, updated_at'

function readLocalNotes(room: string): SessionNote[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(NOTES_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionNote[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalNotes(room: string, notes: SessionNote[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(NOTES_LOCAL_KEY(room), JSON.stringify(notes))
}

export async function fetchSessionNotes(room: string): Promise<{ notes: SessionNote[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(MASTER_SESSION_NOTES)
      .select(NOTE_SELECT)
      .eq('room', room)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return {
      notes: (data || []).map(row => mapSessionNoteRow(row as SessionNoteRow)),
      source: 'remote',
    }
  } catch {
    return { notes: readLocalNotes(room), source: 'local' }
  }
}

export async function upsertSessionNote(note: SessionNote): Promise<{ source: 'remote' | 'local' }> {
  try {
    const { error } = await createClient()
      .from(MASTER_SESSION_NOTES)
      .upsert(toSessionNoteRow(note), { onConflict: 'id' })
    if (error) throw error
    return { source: 'remote' }
  } catch {
    const existing = readLocalNotes(note.room)
    const next = [note, ...existing.filter(item => item.id !== note.id)]
    writeLocalNotes(note.room, next)
    return { source: 'local' }
  }
}

export async function deleteSessionNote(room: string, noteId: string): Promise<void> {
  try {
    const { error } = await createClient().from(MASTER_SESSION_NOTES).delete().eq('id', noteId)
    if (error) throw error
  } catch {
    writeLocalNotes(room, readLocalNotes(room).filter(item => item.id !== noteId))
  }
}
