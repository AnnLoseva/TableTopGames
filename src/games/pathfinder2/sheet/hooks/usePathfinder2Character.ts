'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  DEFAULT_PATHFINDER2_DRAFT,
  PATHFINDER2_DRAFT_STORAGE_KEY,
} from '../data'
import {
  parseAndMigratePathfinder2Draft,
} from '../data/migration'
import type {
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
} from '../types'

type CharacterUpdater = (
  current: Pathfinder2CharacterDraft,
) => Pathfinder2CharacterDraft

export function usePathfinder2Character(catalog: Pathfinder2RulesCatalog) {
  const [draft, setDraft] = useState<Pathfinder2CharacterDraft>(
    DEFAULT_PATHFINDER2_DRAFT,
  )
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Подготовка черновика')
  const [migrationWarnings, setMigrationWarnings] = useState<string[]>([])
  const draftRef = useRef(draft)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback((nextDraft: Pathfinder2CharacterDraft) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    window.localStorage.setItem(
      PATHFINDER2_DRAFT_STORAGE_KEY,
      JSON.stringify(nextDraft),
    )
    setSaveStatus('Сохранено локально')
  }, [])

  const schedulePersist = useCallback((
    nextDraft: Pathfinder2CharacterDraft,
    immediate: boolean,
  ) => {
    setSaveStatus('Сохраняю…')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (immediate) {
      persist(nextDraft)
      return
    }
    saveTimerRef.current = setTimeout(() => persist(nextDraft), 320)
  }, [persist])

  useEffect(() => {
    const stored = window.localStorage.getItem(PATHFINDER2_DRAFT_STORAGE_KEY)
    const parsed = stored ? parseAndMigratePathfinder2Draft(stored, catalog) : null
    const nextDraft = parsed?.draft ?? DEFAULT_PATHFINDER2_DRAFT
    draftRef.current = nextDraft
    setDraft(nextDraft)
    setMigrationWarnings([
      ...catalog.validationWarnings,
      ...(stored && !parsed ? ['Локальный черновик повреждён и не был загружен.'] : []),
      ...(parsed?.warnings ?? []),
    ])
    setHydrated(true)

    if (parsed?.migrated) {
      window.localStorage.setItem(
        PATHFINDER2_DRAFT_STORAGE_KEY,
        JSON.stringify(nextDraft),
      )
      setSaveStatus('Черновик обновлён и сохранён')
    } else {
      setSaveStatus(parsed ? 'Черновик восстановлен' : 'Новый локальный черновик')
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        window.localStorage.setItem(
          PATHFINDER2_DRAFT_STORAGE_KEY,
          JSON.stringify(draftRef.current),
        )
      }
    }
  }, [catalog])

  const updateCharacter = useCallback((
    updater: CharacterUpdater,
    options: { immediate?: boolean } = {},
  ) => {
    const nextDraft = updater(draftRef.current)
    draftRef.current = nextDraft
    setDraft(nextDraft)
    if (hydrated) schedulePersist(nextDraft, Boolean(options.immediate))
  }, [hydrated, schedulePersist])

  const updateField = useCallback(<Key extends keyof Pathfinder2CharacterDraft>(
    key: Key,
    value: Pathfinder2CharacterDraft[Key],
    options: { immediate?: boolean } = {},
  ) => {
    updateCharacter(
      current => ({ ...current, [key]: value }),
      options,
    )
  }, [updateCharacter])

  const resetCharacter = useCallback(() => {
    const nextDraft: Pathfinder2CharacterDraft = {
      ...DEFAULT_PATHFINDER2_DRAFT,
      attributes: { ...DEFAULT_PATHFINDER2_DRAFT.attributes },
      trainedSkills: [],
      ancestryFeatIds: [],
      classFeatIds: [],
      skillFeatIds: [],
      generalFeatIds: [],
      unresolvedSelections: {},
    }
    draftRef.current = nextDraft
    setDraft(nextDraft)
    setMigrationWarnings([])
    persist(nextDraft)
  }, [persist])

  const clearMigrationWarnings = useCallback(() => {
    setMigrationWarnings([])
  }, [])

  return {
    draft,
    hydrated,
    saveStatus,
    migrationWarnings,
    updateCharacter,
    updateField,
    resetCharacter,
    clearMigrationWarnings,
  }
}
