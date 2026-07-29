'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { VTM_THEME_CLASS } from '@/games/vampires/modules/ui/vtm-theme'
import DesktopSizeGuard from './components/DesktopSizeGuard'
import MasterCommandPalette, { shouldHandleSearchShortcut } from './components/MasterCommandPalette'
import MasterConsoleSidebar from './components/MasterConsoleSidebar'
import MasterConsoleTopbar from './components/MasterConsoleTopbar'
import MasterModuleHost from './components/MasterModuleHost'
import MasterRightRail from './components/MasterRightRail'
import { DEFAULT_MASTER_MODULE_ID, getMasterContribution } from './contributions'
import { useMasterLayouts } from './hooks/useMasterLayouts'
import { useMasterWindowSync } from './hooks/useMasterWindowSync'
import { openDetachedMasterWindow } from './multi-window'
import { parseMasterDeepLink, navigateMasterDeepLink } from './search/deep-link'
import type { MasterDisplayMode } from './multi-window/types'
import type { MasterRollRequest } from './types'

type MasterConsoleShellProps = {
  room: string
  onLock: () => void
}

function readShellFromUrl(): { moduleId: string; display: MasterDisplayMode; layoutId: string | null } {
  if (typeof window === 'undefined') {
    return { moduleId: DEFAULT_MASTER_MODULE_ID, display: 'primary', layoutId: null }
  }
  const parsed = parseMasterDeepLink(window.location.search)
  return {
    moduleId: parsed.moduleId,
    display: parsed.display,
    layoutId: parsed.layoutId,
  }
}

export default function MasterConsoleShell({ room, onLock }: MasterConsoleShellProps) {
  const initial = useMemo(() => readShellFromUrl(), [])
  const [activeModuleId, setActiveModuleId] = useState(initial.moduleId)
  const [display, setDisplay] = useState<MasterDisplayMode>(initial.display)
  const [rollRequest, setRollRequest] = useState<MasterRollRequest | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [rollerFocusToken, setRollerFocusToken] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)

  const layouts = useMasterLayouts(room, initial.layoutId)

  useEffect(() => {
    const boot = readShellFromUrl()
    setActiveModuleId(boot.moduleId)
    setDisplay(boot.display)
    // Apply layout's active module if layout selected and no explicit module conflict
    if (boot.layoutId && layouts.activeState.activeModuleId && !new URLSearchParams(window.location.search).get('module')) {
      setActiveModuleId(layouts.activeState.activeModuleId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!layouts.activeLayout || !layouts.activeState.activeModuleId) return
    const url = new URLSearchParams(window.location.search)
    // Only follow layout module when layout= is present and module not forced
    if (url.get('layout') && !url.get('module')) {
      setActiveModuleId(layouts.activeState.activeModuleId)
    }
  }, [layouts.activeLayout?.id, layouts.activeState.activeModuleId])

  const onRemoteLayoutHint = useCallback((layoutId: string) => {
    if (layoutId === layouts.activeLayoutId) {
      void layouts.reload()
      setStatusMessage('Раскладка обновлена в другом окне')
    }
  }, [layouts])

  const onReloadHint = useCallback(() => {
    setReloadToken(token => token + 1)
    void layouts.reload()
  }, [layouts])

  const windowSync = useMasterWindowSync({
    room,
    display,
    moduleId: activeModuleId,
    layoutId: layouts.activeLayoutId,
    onRemoteLayoutHint,
    onReloadHint,
    onStatus: setStatusMessage,
  })

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ moduleId?: string; display?: MasterDisplayMode }>).detail
      if (detail?.moduleId && getMasterContribution(detail.moduleId)) {
        setActiveModuleId(detail.moduleId)
      }
      if (detail?.display) setDisplay(detail.display)
    }
    window.addEventListener('master-console:navigate', onNavigate)
    return () => window.removeEventListener('master-console:navigate', onNavigate)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleSearchShortcut(event)) return
      event.preventDefault()
      event.stopPropagation()
      setPaletteOpen(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    if (!statusMessage) return
    const t = window.setTimeout(() => setStatusMessage(null), 4500)
    return () => window.clearTimeout(t)
  }, [statusMessage])

  const onSelectModule = useCallback((id: string) => {
    if (!getMasterContribution(id)) return
    navigateMasterDeepLink({
      room,
      moduleId: id,
      display,
      layoutId: layouts.activeLayoutId,
    })
    setActiveModuleId(id)
  }, [room, display, layouts.activeLayoutId])

  const openRoller = useCallback(() => {
    setRollerFocusToken(token => token + 1)
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.master-right-rail')?.focus()
    })
  }, [])

  const openDetached = useCallback((moduleId?: string) => {
    const result = openDetachedMasterWindow({
      room,
      moduleId: moduleId || activeModuleId,
      layoutId: layouts.activeLayout?.name === 'second-screen'
        ? layouts.activeLayout.id
        : layouts.activeLayoutId || undefined,
    })
    if (!result.ok) {
      setStatusMessage(result.message)
      return
    }
    setStatusMessage('Открыто отдельное окно (второй монитор)')
  }, [room, activeModuleId, layouts.activeLayout, layouts.activeLayoutId])

  const saveCurrentLayout = useCallback(async () => {
    const saved = await layouts.saveActive({
      schemaVersion: 1,
      activeModuleId,
      secondaryModuleIds: layouts.activeState.secondaryModuleIds,
      label: layouts.activeState.label,
    })
    if (saved) {
      windowSync.broadcastLayoutHint(saved.id, saved.layoutVersion, saved.updatedAt)
    }
  }, [layouts, activeModuleId, windowSync])

  const detached = display === 'detached'

  return (
    <div
      className={`master-console ${VTM_THEME_CLASS}${detached ? ' master-console--detached' : ''}`}
      data-display={display}
      data-reload={reloadToken}
    >
      <MasterConsoleTopbar
        room={room}
        onLock={onLock}
        onOpenSearch={() => setPaletteOpen(true)}
        statusMessage={statusMessage || layouts.status}
        display={display}
        peerCount={windowSync.peerCount}
        onOpenDetached={() => openDetached()}
        layoutName={layouts.activeLayout?.name}
        onSaveLayout={() => void saveCurrentLayout()}
      />

      {layouts.conflict ? (
        <div className="master-layout-conflict" role="alert">
          <strong>Конфликт раскладки</strong>
          <span>{layouts.conflict.message}</span>
          <div className="master-layout-conflict-actions">
            <button type="button" onClick={() => void layouts.resolveConflictKeepMine()}>Оставить мою</button>
            <button type="button" onClick={() => layouts.resolveConflictTakeTheirs()}>Взять их</button>
            <button type="button" onClick={() => void layouts.resolveConflictSaveCopy()}>Сохранить копию</button>
          </div>
        </div>
      ) : null}

      <div className={`master-console-layout${detached ? ' master-console-layout--detached' : ''}`}>
        {!detached ? (
          <MasterConsoleSidebar
            activeModuleId={activeModuleId}
            onSelectModule={onSelectModule}
            layouts={layouts.layouts}
            activeLayoutId={layouts.activeLayoutId}
            onSelectLayout={(id) => {
              layouts.setActiveLayoutId(id)
              const layout = layouts.layouts.find(item => item.id === id)
              navigateMasterDeepLink({
                room,
                moduleId: layout ? (layouts.activeState.activeModuleId || activeModuleId) : activeModuleId,
                layoutId: layout?.name || id,
                display,
              })
              if (layout) {
                const state = layout.layoutJson as { activeModuleId?: string }
                if (state?.activeModuleId && getMasterContribution(state.activeModuleId)) {
                  setActiveModuleId(state.activeModuleId)
                }
              }
            }}
            onOpenDetachedModule={(id) => openDetached(id)}
          />
        ) : null}
        <MasterModuleHost
          room={room}
          activeModuleId={activeModuleId}
          onRequestRoll={setRollRequest}
        />
        {!detached ? (
          <MasterRightRail
            room={room}
            rollRequest={rollRequest}
            onClearRollRequest={() => setRollRequest(null)}
            focusToken={rollerFocusToken}
          />
        ) : (
          <MasterRightRail
            room={room}
            rollRequest={rollRequest}
            onClearRollRequest={() => setRollRequest(null)}
            focusToken={rollerFocusToken}
          />
        )}
      </div>
      {!detached ? <DesktopSizeGuard /> : null}
      <MasterCommandPalette
        room={room}
        role="master"
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenRoller={openRoller}
        onStatus={setStatusMessage}
      />
    </div>
  )
}
