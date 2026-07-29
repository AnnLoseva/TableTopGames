import type { Dispatch, SetStateAction } from 'react'
import type { JournalEntry } from '../types'

export type JournalActionsDeps = {
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  journalStorageKey: string
  journalEntries: JournalEntry[]
  selectedJournalEntry: JournalEntry | null
  setJournalEntries: Dispatch<SetStateAction<JournalEntry[]>>
  setSelectedJournalEntryId: Dispatch<SetStateAction<string>>
  setJournalSaveStatus: Dispatch<SetStateAction<string>>
}

export function createJournalActions(deps: JournalActionsDeps) {
  const saveJournalEntries = (entries: JournalEntry[], status = 'Сохранено') => {
    deps.setJournalEntries(entries)
    if (deps.journalStorageKey) {
      window.localStorage.setItem(deps.journalStorageKey, JSON.stringify(entries))
    }
    deps.setJournalSaveStatus(status)
  }

  const createJournalEntry = () => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: deps.t('Новая запись'),
      text: '',
      createdAt: now,
      updatedAt: now,
    }
    saveJournalEntries([entry, ...deps.journalEntries], 'Сохранено')
    deps.setSelectedJournalEntryId(entry.id)
  }

  const updateJournalEntry = (patch: Partial<Pick<JournalEntry, 'title' | 'text'>>) => {
    const selectedEntry = deps.selectedJournalEntry
    if (!selectedEntry) return
    const now = new Date().toISOString()
    const next = deps.journalEntries.map(entry =>
      entry.id === selectedEntry.id ? { ...entry, ...patch, updatedAt: now } : entry
    )
    deps.setJournalEntries(next)
    deps.setJournalSaveStatus('Есть несохранённые изменения')
  }

  const persistCurrentJournal = () => {
    if (!deps.journalStorageKey) return
    window.localStorage.setItem(deps.journalStorageKey, JSON.stringify(deps.journalEntries))
    deps.setJournalSaveStatus('Сохранено')
  }

  const deleteJournalEntry = () => {
    const selectedEntry = deps.selectedJournalEntry
    if (!selectedEntry) return
    const title = selectedEntry.title || deps.t('Без названия')
    if (!window.confirm(deps.tf('Удалить запись "{title}"?', { title }))) return
    const next = deps.journalEntries.filter(entry => entry.id !== selectedEntry.id)
    saveJournalEntries(next, 'Сохранено')
    deps.setSelectedJournalEntryId(next[0]?.id || '')
  }

  return {
    saveJournalEntries,
    createJournalEntry,
    updateJournalEntry,
    persistCurrentJournal,
    deleteJournalEntry,
  }
}