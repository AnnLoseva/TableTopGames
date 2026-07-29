'use client'

import { useMusicEngineMount } from '../hooks/useMusic'

export function GlobalMusicEngineMount() {
  return <div {...useMusicEngineMount()} />
}
