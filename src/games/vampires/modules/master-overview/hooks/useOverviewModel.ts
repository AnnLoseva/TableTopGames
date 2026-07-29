'use client'

import { useEffect, useMemo, useState } from 'react'
import { useChronicleActors } from '@/games/vampires/modules/actors/hooks'
import { useActiveSceneId } from '@/games/vampires/modules/actors/hooks/useActiveSceneId'
import { normalizeActor } from '@/games/vampires/modules/actors/services/actor-service'
import { fetchChronicleSessions, getMasterMembership } from '@/games/vampires/modules/master-console/api'
import { useMasterActionLog } from '@/games/vampires/modules/master-console/hooks'
import { fetchRollHistory } from '@/games/vampires/modules/table/api/roll-api'
import { fetchScenes } from '@/games/vampires/modules/table/api/scene-api'
import type { RollMessage } from '@/games/vampires/modules/table/types'
import {
  countOpenConsequences,
  mergeTimeline,
  selectCoterieSummary,
  selectSceneNpcs,
  selectTimelineFromActionLog,
  selectTimelineFromRolls,
} from '../selectors'
import type { OverviewModel } from '../types'
import { usePlotHooks } from './usePlotHooks'

export function useOverviewModel(room: string) {
  const { actors, loading: actorsLoading, error: actorsError, reload: reloadActors } = useChronicleActors(room)
  const activeSceneId = useActiveSceneId(room)
  const actionLog = useMasterActionLog(room)
  const [chronicleId, setChronicleId] = useState('')
  const [sceneName, setSceneName] = useState<string | null>(null)
  const [publicRolls, setPublicRolls] = useState<RollMessage[]>([])
  const [sessionLabel, setSessionLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!room) return
    let cancelled = false
    void getMasterMembership(room).then(membership => {
      if (!cancelled && membership) setChronicleId(membership.chronicleId)
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [room])

  useEffect(() => {
    if (!chronicleId && actors[0]?.chronicleId) setChronicleId(actors[0].chronicleId)
  }, [actors, chronicleId])

  useEffect(() => {
    if (!room) return
    let cancelled = false
    void fetchScenes(room).then(({ scenes }) => {
      if (cancelled) return
      const active = scenes.find(scene => scene.id === activeSceneId) || scenes.find(scene => scene.isActive)
      setSceneName(active?.name || null)
    }).catch(() => {
      if (!cancelled) setSceneName(null)
    })
    return () => {
      cancelled = true
    }
  }, [room, activeSceneId])

  useEffect(() => {
    if (!room) return
    let cancelled = false
    void fetchRollHistory(room).then(({ rolls }) => {
      if (!cancelled) setPublicRolls(rolls || [])
    }).catch(() => {
      if (!cancelled) setPublicRolls([])
    })
    void fetchChronicleSessions(room).then(sessions => {
      if (cancelled) return
      const active = sessions.find(session => session.status === 'active') || sessions[0]
      if (active) {
        setSessionLabel(`сессия ${active.sequenceNumber} · ночь ${active.nightNumber}`)
      } else {
        setSessionLabel(null)
      }
    }).catch(() => {
      if (!cancelled) setSessionLabel(null)
    })
    return () => {
      cancelled = true
    }
  }, [room, actionLog.entries.length])

  const plotsState = usePlotHooks(room, chronicleId)

  const model: OverviewModel = useMemo(() => {
    const actorsById = new Map(actors.map(actor => [actor.id, actor]))
    const normalizedById = new Map(actors.map(actor => [actor.id, normalizeActor(actor)]))
    const timeline = mergeTimeline(
      selectTimelineFromActionLog(actionLog.entries),
      selectTimelineFromRolls(publicRolls),
    )
    const openConsequenceCount = countOpenConsequences(timeline)
    return {
      coterie: selectCoterieSummary(actors, openConsequenceCount),
      sceneNpcs: selectSceneNpcs(actors, activeSceneId),
      activeSceneId,
      activeSceneName: sceneName,
      plots: plotsState.plots,
      timeline,
      actorsById,
      normalizedById,
      actionLog: actionLog.entries,
    }
  }, [actors, actionLog.entries, activeSceneId, publicRolls, plotsState.plots, sceneName])

  return {
    model,
    chronicleId,
    sessionLabel,
    actorsLoading,
    actorsError,
    reloadActors,
    plotsState,
  }
}
