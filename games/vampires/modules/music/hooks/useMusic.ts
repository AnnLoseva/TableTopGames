'use client'

import { useMemo } from 'react'
import type { CSSProperties } from 'react'

export const GLOBAL_MUSIC_ENGINE_ID = 'global-music-engine'

export type MusicEngineMountProps = {
  id: typeof GLOBAL_MUSIC_ENGINE_ID
  'aria-hidden': true
  style: CSSProperties
}

const globalMusicEngineStyle: CSSProperties = {
  position: 'fixed',
  left: '-10000px',
  top: 0,
  width: 640,
  height: 360,
  overflow: 'hidden',
  pointerEvents: 'none',
}

export function useMusicEngineMount(): MusicEngineMountProps {
  return useMemo(
    () => ({
      id: GLOBAL_MUSIC_ENGINE_ID,
      'aria-hidden': true,
      style: globalMusicEngineStyle,
    }),
    [],
  )
}
