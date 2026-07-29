'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchRollHistory } from '../api/roll-api'
import type { RollMessage } from '../types'
import { mergeRoll } from '../utils/layer-utils'

export function useTableRolls(room: string) {
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [rollsStatus, setRollsStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setRollsStatus('loading')

    fetchRollHistory(room)
      .then(({ rolls: loadedRolls, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить историю бросков:', error)
          setRollsStatus('error')
          return
        }
        setRolls(loadedRolls)
        setRollsStatus('ok')
      })

    return () => {
      cancelled = true
    }
  }, [room])

  const mergeRollIntoState = useCallback((roll: RollMessage) => {
    setRolls(prev => mergeRoll(prev, roll))
  }, [])

  return {
    rolls,
    setRolls,
    rollsStatus,
    mergeRollIntoState,
  }
}