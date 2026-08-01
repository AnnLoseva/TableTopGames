'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import type { TableRole } from '../types'
import {
  clearTableRole,
  getRoleFromLocation,
  getRoomFromLocation,
  rememberRoom,
  rememberTableRole,
  verifyMasterPassword,
} from '../utils/room-session'

type UseRoomSessionOptions = {
  t: (ru: string) => string
}

export function useRoomSession({ t }: UseRoomSessionOptions) {
  const [room, setRoom] = useState('campaign-666')
  const [tableRole, setTableRole] = useState<TableRole | null>(null)
  const [masterPasswordDraft, setMasterPasswordDraft] = useState('')
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
      clearTableRole()
    } else if (savedRole === 'master' || savedRole === 'player') {
      setTableRole(savedRole)
    }
  }, [])

  const chooseTableRole = (role: TableRole) => {
    rememberTableRole(role)
    setTableRole(role)
  }

  const enterAsMaster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!verifyMasterPassword(masterPasswordDraft)) {
      window.alert(t('Пароль мастера не подошёл.'))
      return
    }
    setMasterPasswordDraft('')
    chooseTableRole('master')
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
    masterPasswordDraft,
    setMasterPasswordDraft,
    chooseTableRole,
    enterAsMaster,
    resetTableRole,
  }
}
