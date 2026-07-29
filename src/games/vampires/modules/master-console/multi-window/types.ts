/** Lightweight multi-window coordination — never large state snapshots. */

export type MasterDisplayMode = 'primary' | 'detached'

export type MasterWindowSignal =
  | {
    type: 'hello'
    windowId: string
    room: string
    display: MasterDisplayMode
    moduleId: string | null
    layoutId: string | null
  }
  | {
    type: 'bye'
    windowId: string
    room: string
  }
  | {
    type: 'navigate-hint'
    windowId: string
    room: string
    moduleId: string
    entityId?: string | null
  }
  | {
    type: 'layout-hint'
    windowId: string
    room: string
    layoutId: string
    layoutVersion: number
    updatedAt: string
  }
  | {
    type: 'reload-hint'
    windowId: string
    room: string
    reason: 'online' | 'visible' | 'manual' | 'layout-conflict'
  }

export type OpenDetachedResult =
  | { ok: true; window: Window; url: string }
  | { ok: false; reason: 'popup-blocked' | 'invalid'; message: string }
