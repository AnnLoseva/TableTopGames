'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChronicleActors } from '@/games/vampires/modules/actors/hooks'
import { normalizeActor } from '@/games/vampires/modules/actors/services/actor-service'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import { fetchBloodBonds, fetchBondEvents } from '../api'
import {
  breakBond,
  createOrGetActiveBond,
  getBondAdapter,
  registerDrink,
  setBondLevel,
  setBondStatus,
  updateBondNotes,
} from '../services'
import { layoutBondGraph } from '../utils/graph-layout'
import type { BloodBond, BloodBondEvent, BondListRow } from '../types'

export type ViewMode = 'graph' | 'list'

export function useBloodBonds(room: string) {
  const { actors, loading: actorsLoading, error: actorsError, reload: reloadActors } = useChronicleActors(room)
  const [bonds, setBonds] = useState<BloodBond[]>([])
  const [events, setEvents] = useState<BloodBondEvent[]>([])
  const [chronicleId, setChronicleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [source, setSource] = useState<'remote' | 'local'>('local')
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [selectedBondId, setSelectedBondId] = useState<string | null>(null)
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const adapter = useMemo(() => getBondAdapter(), [])

  const reload = useCallback(async () => {
    if (!room) return
    setLoading(true)
    try {
      const [bondResult, eventRows, membership] = await Promise.all([
        fetchBloodBonds(room),
        fetchBondEvents(room),
        getMasterMembership(room).catch(() => null),
      ])
      setBonds(bondResult.bonds)
      setEvents(eventRows)
      setSource(bondResult.source)
      if (membership) setChronicleId(membership.chronicleId)
      else if (bondResult.bonds[0]) setChronicleId(bondResult.bonds[0].chronicleId)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить узы')
    } finally {
      setLoading(false)
    }
  }, [room])

  useEffect(() => {
    void reload()
  }, [reload])

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const actor of actors) {
      map.set(actor.id, normalizeActor(actor).displayName)
    }
    return map
  }, [actors])

  const isPc = useCallback((actorId: string) => {
    const actor = actors.find(item => item.id === actorId)
    return actor?.kind === 'player_character'
  }, [actors])

  const layoutActors = useMemo(() => actors
    .filter(actor => actor.status !== 'archived')
    .map(actor => ({
      id: actor.id,
      label: normalizeActor(actor).displayName,
      isPc: actor.kind === 'player_character',
    })), [actors])

  const graph = useMemo(
    () => layoutBondGraph(layoutActors, bonds.filter(bond => bond.visibility === 'master' || bond.visibility === 'shared')),
    [layoutActors, bonds],
  )

  const listRows: BondListRow[] = useMemo(() => {
    return bonds
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(bond => {
        const effects = adapter.getLevelEffects(bond.level)
        const warnings = adapter.computeWarnings({
          level: bond.level,
          drinksCount: bond.drinksCount,
          status: bond.status,
          expiresAt: bond.expiresAt,
        })
        return {
          bond,
          thrallName: nameById.get(bond.thrallActorId) || bond.thrallActorId.slice(0, 8),
          regnantName: nameById.get(bond.regnantActorId) || bond.regnantActorId.slice(0, 8),
          warning: warnings.find(item => item.severity !== 'info')?.message || warnings[0]?.message || '',
          levelTitle: effects.title,
        }
      })
  }, [adapter, bonds, nameById])

  const selectedBond = useMemo(
    () => bonds.find(bond => bond.id === selectedBondId) || null,
    [bonds, selectedBondId],
  )

  const selectedEvents = useMemo(() => {
    if (!selectedBondId) return []
    return events.filter(event => event.bondId === selectedBondId)
  }, [events, selectedBondId])

  const bondsForActor = useCallback((actorId: string) => {
    return bonds.filter(bond => (
      bond.thrallActorId === actorId || bond.regnantActorId === actorId
    ))
  }, [bonds])

  const ensureChronicle = useCallback(() => {
    if (!chronicleId) throw new Error('Нужен chronicle_id (Auth membership)')
    return chronicleId
  }, [chronicleId])

  const createBond = useCallback(async (thrallActorId: string, regnantActorId: string) => {
    setBusy(true)
    try {
      const bond = await createOrGetActiveBond({
        chronicleId: ensureChronicle(),
        room,
        thrallActorId,
        regnantActorId,
      })
      setSelectedBondId(bond.id)
      setStatus('Узы созданы / нормализованы')
      await reload()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Не удалось создать узы')
    } finally {
      setBusy(false)
    }
  }, [ensureChronicle, reload, room])

  const refreshBond = useCallback(async (bond: BloodBond) => {
    setBonds(prev => [bond, ...prev.filter(item => item.id !== bond.id)])
    const nextEvents = await fetchBondEvents(room, bond.id)
    setEvents(prev => {
      const others = prev.filter(event => event.bondId !== bond.id)
      return [...nextEvents, ...others]
    })
  }, [room])

  const drink = useCallback(async () => {
    if (!selectedBond) return
    setBusy(true)
    try {
      const next = await registerDrink(selectedBond)
      await refreshBond(next)
      setStatus('Глоток учтён')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }, [refreshBond, selectedBond])

  const changeLevel = useCallback(async (delta: number) => {
    if (!selectedBond) return
    setBusy(true)
    try {
      const next = await setBondLevel(selectedBond, selectedBond.level + delta)
      await refreshBond(next)
      setStatus(`Уровень → ${next.level}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Ошибка уровня')
    } finally {
      setBusy(false)
    }
  }, [refreshBond, selectedBond])

  const breakSelected = useCallback(async () => {
    if (!selectedBond) return
    setBusy(true)
    try {
      const next = await breakBond(selectedBond)
      await refreshBond(next)
      setStatus('Узы разорваны (история сохранена)')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Ошибка разрыва')
    } finally {
      setBusy(false)
    }
  }, [refreshBond, selectedBond])

  const deactivateSelected = useCallback(async () => {
    if (!selectedBond) return
    setBusy(true)
    try {
      const next = await setBondStatus(selectedBond, selectedBond.status === 'inactive' ? 'active' : 'inactive')
      await refreshBond(next)
      setStatus(`Статус → ${next.status}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Ошибка статуса')
    } finally {
      setBusy(false)
    }
  }, [refreshBond, selectedBond])

  const saveNotes = useCallback(async (notes: string) => {
    if (!selectedBond) return
    const next = await updateBondNotes(selectedBond, notes)
    setBonds(prev => prev.map(item => (item.id === next.id ? next : item)))
  }, [selectedBond])

  return {
    actors,
    actorsLoading,
    actorsError,
    reloadActors,
    bonds,
    events,
    listRows,
    graph,
    nameById,
    isPc,
    adapter,
    loading,
    error,
    status,
    setStatus,
    source,
    busy,
    viewMode,
    setViewMode,
    selectedBondId,
    setSelectedBondId,
    selectedActorId,
    setSelectedActorId,
    selectedBond,
    selectedEvents,
    bondsForActor,
    chronicleId,
    setChronicleId,
    createBond,
    drink,
    changeLevel,
    breakSelected,
    deactivateSelected,
    saveNotes,
    reload,
  }
}
