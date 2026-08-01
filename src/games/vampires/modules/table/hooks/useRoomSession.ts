'use client'

import { useEffect, useRef, useState } from 'react'
import type { TableRole } from '../types'
import {
  clearTableRole,
  getRoleFromLocation,
  getRoomFromLocation,
  rememberRoom,
  rememberTableRole,
} from '../utils/room-session'

export function useRoomSession() {
  const [room, setRoom] = useState('campaign-666')
  const [tableRole, setTableRole] = useState<TableRole | null>(null)
  const roomRef = useRef(room)

  useEffect(() => {
    roomRef.current = room
  }, [room])

  useEffect(() => {
    const currentRoom = getRoomFromLocation()
    setRoom(currentRoom)
    rememberRoom(currentRoom)
  }, [])

  useEffect(() => {
    const savedRole = window.localStorage.getItem('vtm-table-role')
    const urlRole = getRoleFromLocation()
    if (urlRole === 'player') {
      rememberTableRole(urlRole)
      setTableRole(urlRole)
    } else if (urlRole === 'master') {
      rememberTableRole(urlRole)
      setTableRole(urlRole)
    } else if (savedRole === 'master' || savedRole === 'player') {
      setTableRole(savedRole)
    }
  }, [])

  const chooseTableRole = (role: TableRole) => {
    rememberTableRole(role)
    setTableRole(role)
  }

  const resetTableRole = () => {
    clearTableRole()
    setTableRole(null)
  }

  const isMaster = tableRole === 'master'

  return {
    room,
    setRoom,
    roomRef,
    tableRole,
    isMaster,
    chooseTableRole,
    resetTableRole,
  }
}
