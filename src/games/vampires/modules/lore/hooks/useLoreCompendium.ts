'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMasterMembership, appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import {
  fetchLoreCategories,
  fetchMasterLoreEntries,
  fetchRandomTables,
  upsertLoreCategory,
  upsertLoreEntry,
  upsertRandomTable,
  fetchEntityLinksInvolving,
  linksToChips,
  createEntityLink,
} from '../api'
import { STANDARD_LORE_CATEGORIES } from '../constants'
import { searchLoreCompendium, rollRandomTable } from '../services'
import type {
  EntityLinkChip,
  LoreCategory,
  LoreEntry,
  LoreSearchHit,
  RandomTable,
  RandomTableRollResult,
  RandomTableRow,
} from '../types'

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `cat-${Date.now().toString(16)}`
}

export function useLoreCompendium(room: string) {
  const [chronicleId, setChronicleId] = useState('')
  const [categories, setCategories] = useState<LoreCategory[]>([])
  const [entries, setEntries] = useState<LoreEntry[]>([])
  const [tables, setTables] = useState<RandomTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [categorySlug, setCategorySlug] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [linkChips, setLinkChips] = useState<EntityLinkChip[]>([])
  const [lastRoll, setLastRoll] = useState<RandomTableRollResult | null>(null)
  const [source, setSource] = useState<'remote' | 'local'>('local')

  const reload = useCallback(async () => {
    if (!room) return
    setLoading(true)
    try {
      const [cats, ents, tabs, membership] = await Promise.all([
        fetchLoreCategories(room),
        fetchMasterLoreEntries(room),
        fetchRandomTables(room),
        getMasterMembership(room).catch(() => null),
      ])
      setCategories(cats.categories)
      setEntries(ents.entries)
      setTables(tabs.tables)
      setSource(
        cats.source === 'remote' || ents.source === 'remote' || tabs.source === 'remote'
          ? 'remote'
          : 'local',
      )
      if (membership) setChronicleId(membership.chronicleId)
      else if (ents.entries[0]?.chronicleId) setChronicleId(ents.entries[0].chronicleId)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить лор')
    } finally {
      setLoading(false)
    }
  }, [room])

  useEffect(() => {
    void reload()
  }, [reload])

  const mergedCategories = useMemo(() => {
    const custom = categories
    const counts = new Map<string, number>()
    for (const entry of entries) {
      counts.set(entry.categorySlug, (counts.get(entry.categorySlug) || 0) + 1)
    }
    for (const table of tables) {
      counts.set('random_tables', (counts.get('random_tables') || 0) + 1)
    }

    const standard: LoreCategory[] = STANDARD_LORE_CATEGORIES.map((item, index) => ({
      id: `standard:${item.slug}`,
      chronicleId,
      room,
      slug: item.slug,
      title: item.title,
      kind: item.kind,
      sortOrder: index,
      isSystem: Boolean(item.systemReferenceSlug),
      entryCount: counts.get(item.slug) || 0,
    }))

    const customMapped = custom
      .filter(item => !STANDARD_LORE_CATEGORIES.some(std => std.slug === item.slug))
      .map(item => ({
        ...item,
        entryCount: counts.get(item.slug) || 0,
      }))

    return [...standard, ...customMapped]
  }, [categories, chronicleId, entries, room, tables])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) entry.tags.forEach(tag => set.add(tag))
    for (const table of tables) table.tags.forEach(tag => set.add(tag))
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [entries, tables])

  const hits: LoreSearchHit[] = useMemo(() => searchLoreCompendium({
    query,
    tags: activeTags,
    categorySlug,
    entries,
    tables,
    includeSystem: true,
    includeMasterOnly: true,
  }), [activeTags, categorySlug, entries, query, tables])

  const selectedEntry = useMemo(
    () => entries.find(entry => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId],
  )
  const selectedTable = useMemo(
    () => tables.find(table => table.id === selectedTableId) || null,
    [tables, selectedTableId],
  )

  useEffect(() => {
    if (!selectedEntry || !room) {
      setLinkChips([])
      return
    }
    let cancelled = false
    void fetchEntityLinksInvolving(room, 'lore_entry', selectedEntry.id).then(links => {
      if (!cancelled) setLinkChips(linksToChips(links, 'lore_entry', selectedEntry.id))
    })
    return () => {
      cancelled = true
    }
  }, [room, selectedEntry])

  const ensureChronicle = useCallback(() => {
    if (!chronicleId) throw new Error('Нужен chronicle_id (Auth membership)')
    return chronicleId
  }, [chronicleId])

  const createEntry = useCallback(async (partial?: Partial<LoreEntry>) => {
    const cid = ensureChronicle()
    const slug = partial?.categorySlug || categorySlug || 'locations'
    const entry: LoreEntry = {
      id: crypto.randomUUID(),
      chronicleId: cid,
      room,
      categoryId: null,
      categorySlug: slug,
      title: partial?.title || 'Новая запись',
      shortSummary: partial?.shortSummary || '',
      bodyHtml: partial?.bodyHtml || '',
      tags: partial?.tags || [],
      visibility: 'master',
      status: 'draft',
      attachments: [],
      privateNote: '',
      createdBy: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await upsertLoreEntry(entry)
    setEntries(prev => [entry, ...prev])
    setSelectedEntryId(entry.id)
    setSelectedTableId(null)
    setStatus('Запись создана (private by default)')
  }, [categorySlug, ensureChronicle, room])

  const saveEntry = useCallback(async (entry: LoreEntry) => {
    await upsertLoreEntry(entry)
    setEntries(prev => [entry, ...prev.filter(item => item.id !== entry.id)])
    setStatus('Запись сохранена')
  }, [])

  const createCategory = useCallback(async (title: string) => {
    const cid = ensureChronicle()
    const category: LoreCategory = {
      id: crypto.randomUUID(),
      chronicleId: cid,
      room,
      slug: slugify(title),
      title: title.trim(),
      kind: 'custom',
      sortOrder: categories.length + 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await upsertLoreCategory(category)
    setCategories(prev => [...prev, category])
    setCategorySlug(category.slug)
    setStatus('Категория создана')
  }, [categories.length, ensureChronicle, room])

  const createTable = useCallback(async () => {
    const cid = ensureChronicle()
    const table: RandomTable = {
      id: crypto.randomUUID(),
      chronicleId: cid,
      room,
      title: 'Новая таблица',
      description: '',
      tags: [],
      visibility: 'master',
      diceExpression: '1d6',
      rows: [
        { id: crypto.randomUUID(), text: 'Результат 1', weight: 1 },
        { id: crypto.randomUUID(), text: 'Результат 2', weight: 1 },
      ],
      createdBy: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await upsertRandomTable(table)
    setTables(prev => [table, ...prev])
    setSelectedTableId(table.id)
    setSelectedEntryId(null)
    setCategorySlug('random_tables')
    setStatus('Таблица создана')
  }, [ensureChronicle, room])

  const saveTable = useCallback(async (table: RandomTable) => {
    await upsertRandomTable(table)
    setTables(prev => [table, ...prev.filter(item => item.id !== table.id)])
    setStatus('Таблица сохранена')
  }, [])

  const rollTable = useCallback(async (table: RandomTable) => {
    const result = rollRandomTable(table)
    if (!result) {
      setStatus('В таблице нет строк с весом > 0')
      return null
    }
    setLastRoll(result)
    try {
      await appendMasterActionLog({
        chronicleId: table.chronicleId || ensureChronicle(),
        room,
        sessionId: null,
        actionType: 'lore.random_table.roll',
        actorType: 'master',
        actorId: 'self',
        summary: `Таблица «${table.title}»: ${result.text}`,
        payload: {
          tableId: table.id,
          rowId: result.rowId,
          text: result.text,
          weight: result.weight,
          totalWeight: result.totalWeight,
          consequence: result.text,
        },
        inversePayload: null,
        visibility: 'master',
      })
    } catch {
      // log may fail without Auth
    }
    setStatus(`Выпало: ${result.text}`)
    return result
  }, [ensureChronicle, room])

  const convertRollToEntry = useCallback(async (
    result: RandomTableRollResult,
    as: 'note' | 'hook' | 'consequence',
  ) => {
    const slug = as === 'hook' ? 'plots' : as === 'consequence' ? 'plots' : 'locations'
    await createEntry({
      categorySlug: slug,
      title: as === 'hook' ? `Крюк: ${result.text.slice(0, 80)}` : result.text.slice(0, 80),
      shortSummary: `Из таблицы «${result.tableTitle}»`,
      bodyHtml: `<p>${result.text}</p>`,
      tags: ['random-table', result.tableTitle.toLowerCase().replace(/\s+/g, '-')],
    })
  }, [createEntry])

  const addLink = useCallback(async (input: {
    targetType: string
    targetId: string
    label: string
    relationType?: string
  }) => {
    if (!selectedEntry) return
    const cid = ensureChronicle()
    await createEntityLink({
      chronicleId: cid,
      room,
      sourceType: 'lore_entry',
      sourceId: selectedEntry.id,
      targetType: input.targetType,
      targetId: input.targetId,
      relationType: input.relationType || 'related',
      label: input.label,
      visibility: 'master',
    })
    const links = await fetchEntityLinksInvolving(room, 'lore_entry', selectedEntry.id)
    setLinkChips(linksToChips(links, 'lore_entry', selectedEntry.id))
    setStatus('Связь добавлена')
  }, [ensureChronicle, room, selectedEntry])

  const patchSelectedEntry = useCallback((patch: Partial<LoreEntry>) => {
    if (!selectedEntry) return
    const next = { ...selectedEntry, ...patch, updatedAt: new Date().toISOString() }
    setEntries(prev => prev.map(item => (item.id === next.id ? next : item)))
    void saveEntry(next)
  }, [saveEntry, selectedEntry])

  const patchSelectedTable = useCallback((patch: Partial<RandomTable>) => {
    if (!selectedTable) return
    const next = { ...selectedTable, ...patch, updatedAt: new Date().toISOString() }
    setTables(prev => prev.map(item => (item.id === next.id ? next : item)))
    void saveTable(next)
  }, [saveTable, selectedTable])

  const updateTableRow = useCallback((rowId: string, patch: Partial<RandomTableRow>) => {
    if (!selectedTable) return
    const rows = selectedTable.rows.map(row => (row.id === rowId ? { ...row, ...patch } : row))
    patchSelectedTable({ rows })
  }, [patchSelectedTable, selectedTable])

  const addTableRow = useCallback(() => {
    if (!selectedTable) return
    patchSelectedTable({
      rows: [
        ...selectedTable.rows,
        { id: crypto.randomUUID(), text: 'Новая строка', weight: 1 },
      ],
    })
  }, [patchSelectedTable, selectedTable])

  return {
    loading,
    error,
    status,
    setStatus,
    source,
    chronicleId,
    setChronicleId,
    mergedCategories,
    allTags,
    query,
    setQuery,
    activeTags,
    setActiveTags,
    categorySlug,
    setCategorySlug,
    hits,
    selectedEntry,
    selectedTable,
    selectedEntryId,
    selectedTableId,
    setSelectedEntryId,
    setSelectedTableId,
    linkChips,
    lastRoll,
    createEntry,
    createCategory,
    createTable,
    saveEntry,
    saveTable,
    rollTable,
    convertRollToEntry,
    addLink,
    patchSelectedEntry,
    patchSelectedTable,
    updateTableRow,
    addTableRow,
    reload,
  }
}
