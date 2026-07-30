'use client'

import { useEffect, useState } from 'react'
import {
  loadPathfinder2RulesCatalog,
  resetPathfinder2RulesCatalog,
  type LoadedPathfinder2RulesCatalog,
} from '../data/rules-catalog-client'

type RulesCatalogState = {
  data: LoadedPathfinder2RulesCatalog | null
  error: string
}

export function usePathfinder2RulesCatalog(retryKey: number) {
  const [state, setState] = useState<RulesCatalogState>({
    data: null,
    error: '',
  })

  useEffect(() => {
    let active = true
    setState({ data: null, error: '' })
    if (retryKey > 0) resetPathfinder2RulesCatalog()

    void loadPathfinder2RulesCatalog()
      .then(data => {
        if (active) setState({ data, error: '' })
      })
      .catch(error => {
        if (!active) return
        setState({
          data: null,
          error: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      active = false
    }
  }, [retryKey])

  return state
}
