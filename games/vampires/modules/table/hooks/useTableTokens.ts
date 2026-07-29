'use client'

import { useCallback, useRef, useState } from 'react'
import { fetchTokensForScene } from '../api/token-api'
import type { CharacterToken } from '../types'

/** Character-token state for the active scene (loaded alongside layers). */
export function useTableTokens() {
  const [tokens, setTokens] = useState<CharacterToken[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const tokensRef = useRef<CharacterToken[]>([])

  const commitTokens = useCallback((next: CharacterToken[] | ((prev: CharacterToken[]) => CharacterToken[])) => {
    setTokens(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      tokensRef.current = resolved
      return resolved
    })
  }, [])

  const loadTokensForScene = useCallback(async (targetRoom: string, sceneId: string) => {
    const { tokens: loaded, error } = await fetchTokensForScene(targetRoom, sceneId)
    if (error) {
      console.error('Не удалось загрузить токены сцены:', error)
      return
    }
    tokensRef.current = loaded
    setTokens(loaded)
  }, [])

  return {
    tokens,
    setTokens: commitTokens,
    tokensRef,
    selectedTokenId,
    setSelectedTokenId,
    loadTokensForScene,
  }
}
