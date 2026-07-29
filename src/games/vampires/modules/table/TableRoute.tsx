'use client'

import { useEffect, useState } from 'react'
import GameTable from './GameTable'
import { bootstrapTableForRoom } from './bootstrap'
import { getRoomFromLocation } from './utils/room-session'

/**
 * Table entry: bootstraps Hub → VTM5 adapters, then mounts the GameTable orchestrator.
 */
export default function TableRoute() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    bootstrapTableForRoom(getRoomFromLocation())
    setReady(true)
  }, [])

  if (!ready) return null

  return <GameTable />
}