'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createMasterWindowBus,
  createWindowId,
  type MasterWindowBus,
} from '../multi-window'
import type { MasterDisplayMode, MasterWindowSignal } from '../multi-window/types'

type UseMasterWindowSyncOptions = {
  room: string
  display: MasterDisplayMode
  moduleId: string | null
  layoutId: string | null
  onRemoteLayoutHint?: (layoutId: string, version: number) => void
  onReloadHint?: (reason: string) => void
  onStatus?: (message: string) => void
}

/**
 * Coordinates multiple master windows for the same room.
 * Does not duplicate domain subscriptions — only small signals.
 */
export function useMasterWindowSync({
  room,
  display,
  moduleId,
  layoutId,
  onRemoteLayoutHint,
  onReloadHint,
  onStatus,
}: UseMasterWindowSyncOptions) {
  const windowIdRef = useRef(createWindowId())
  const busRef = useRef<MasterWindowBus | null>(null)
  const [peerCount, setPeerCount] = useState(0)
  const peersRef = useRef<Map<string, number>>(new Map())

  const post = useCallback((signal: Omit<MasterWindowSignal, 'windowId' | 'room'> & { type: MasterWindowSignal['type'] }) => {
    busRef.current?.post({
      ...signal,
      windowId: windowIdRef.current,
      room,
    } as MasterWindowSignal)
  }, [room])

  useEffect(() => {
    if (!room) return
    const bus = createMasterWindowBus(room)
    busRef.current = bus

    const prune = () => {
      const now = Date.now()
      for (const [id, ts] of peersRef.current) {
        if (now - ts > 30_000) peersRef.current.delete(id)
      }
      setPeerCount(peersRef.current.size)
    }

    const unsub = bus.subscribe(signal => {
      if (signal.room !== room) return
      if (signal.windowId === windowIdRef.current) return

      if (signal.type === 'hello' || signal.type === 'layout-hint' || signal.type === 'navigate-hint') {
        peersRef.current.set(signal.windowId, Date.now())
        setPeerCount(peersRef.current.size)
      }
      if (signal.type === 'bye') {
        peersRef.current.delete(signal.windowId)
        setPeerCount(peersRef.current.size)
      }
      if (signal.type === 'layout-hint') {
        onRemoteLayoutHint?.(signal.layoutId, signal.layoutVersion)
      }
      if (signal.type === 'reload-hint') {
        onReloadHint?.(signal.reason)
      }
    })

    bus.post({
      type: 'hello',
      windowId: windowIdRef.current,
      room,
      display,
      moduleId,
      layoutId,
    })

    const heartbeat = window.setInterval(() => {
      bus.post({
        type: 'hello',
        windowId: windowIdRef.current,
        room,
        display,
        moduleId,
        layoutId,
      })
      prune()
    }, 12_000)

    const onOnline = () => {
      onStatus?.('Сеть восстановлена — синхронизация…')
      onReloadHint?.('online')
      bus.post({
        type: 'reload-hint',
        windowId: windowIdRef.current,
        room,
        reason: 'online',
      })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        onReloadHint?.('visible')
      }
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      bus.post({
        type: 'bye',
        windowId: windowIdRef.current,
        room,
      })
      window.clearInterval(heartbeat)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      unsub()
      bus.dispose()
      busRef.current = null
      peersRef.current.clear()
    }
  }, [room, display, moduleId, layoutId, onRemoteLayoutHint, onReloadHint, onStatus])

  const broadcastLayoutHint = useCallback((id: string, version: number, updatedAt: string) => {
    post({
      type: 'layout-hint',
      layoutId: id,
      layoutVersion: version,
      updatedAt,
    } as Omit<MasterWindowSignal, 'windowId' | 'room'>)
  }, [post])

  return {
    windowId: windowIdRef.current,
    peerCount,
    broadcastLayoutHint,
    postSignal: post,
  }
}
