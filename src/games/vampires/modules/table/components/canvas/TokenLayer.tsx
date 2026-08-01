'use client'

import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { TOKEN_LAYER_Z } from '@/games/vampires/modules/table/constants'
import type { CharacterToken, TokenPatch } from '@/games/vampires/modules/table/types'

const DRAG_THRESHOLD = 5
const DOUBLE_TAP_DELAY = 300
/** Inline style raise while dragging; committed as a real zIndex patch on release. */
const DRAG_RAISE_Z = 999999

type TokenDragState = {
  /** Snapshot of the dragged token at pointerdown (safe against mid-drag re-renders). */
  token: CharacterToken
  mode: 'move' | 'resize'
  corner?: 'nw' | 'ne' | 'sw' | 'se'
  pointerId: number
  startClientX: number
  startClientY: number
  moved: boolean
  previewX: number
  previewY: number
  previewWidth: number
  previewHeight: number
  aspectRatio: number
  /** Removes the window listeners installed for this drag. */
  cleanup: () => void
}

export type TokenLayerProps = {
  tokens: CharacterToken[]
  sceneBounds: { width: number; height: number }
  zoom: number
  isMaster: boolean
  /** Player Table mode: every token is clipped to the stage. */
  clipToStage: boolean
  selectedTokenId: string | null
  setSelectedTokenId: (id: string | null) => void
  canManageToken: (token: CharacterToken) => boolean
  canResizeToken: (token: CharacterToken) => boolean
  patchToken: (tokenId: string, patch: TokenPatch) => Promise<void>
  bringTokenToFront: (tokenId: string) => Promise<void>
  deleteToken: (tokenId: string) => Promise<void>
  onOpenCharacter: (token: CharacterToken) => void
}

export default function TokenLayer({
  tokens,
  sceneBounds,
  zoom,
  isMaster,
  clipToStage,
  selectedTokenId,
  setSelectedTokenId,
  canManageToken,
  canResizeToken,
  patchToken,
  bringTokenToFront,
  deleteToken,
  onOpenCharacter,
}: TokenLayerProps) {
  const { t } = useLang()
  const dragRef = useRef<TokenDragState | null>(null)
  const lastTapRef = useRef<{ tokenId: string; at: number }>({ tokenId: '', at: 0 })
  const zoomRef = useRef(zoom)
  const tokensRef = useRef(tokens)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    tokensRef.current = tokens
  }, [tokens])

  useEffect(() => () => {
    dragRef.current?.cleanup()
    dragRef.current = null
  }, [])

  const getTokenElement = (tokenId: string) =>
    document.querySelector<HTMLElement>(`.character-token[data-token-id="${CSS.escape(tokenId)}"]`)

  const applyDragPreview = (drag: TokenDragState, clientX: number, clientY: number) => {
    const sceneDx = (clientX - drag.startClientX) / zoomRef.current
    const sceneDy = (clientY - drag.startClientY) / zoomRef.current
    const element = getTokenElement(drag.token.id)

    if (drag.mode === 'move') {
      drag.previewX = Math.round(drag.token.x + sceneDx)
      drag.previewY = Math.round(drag.token.y + sceneDy)
      if (element) element.style.transform = `translate3d(${sceneDx}px, ${sceneDy}px, 0)`
      return
    }

    const horizontal = drag.corner?.includes('w') ? -sceneDx : sceneDx
    const vertical = drag.corner?.includes('n') ? -sceneDy : sceneDy
    const widthFromX = drag.token.width + horizontal
    const widthFromY = (drag.token.height + vertical) * drag.aspectRatio
    const width = Math.max(24, Math.round(Math.abs(horizontal) > Math.abs(vertical) ? widthFromX : widthFromY))
    const height = Math.max(24, Math.round(width / drag.aspectRatio))
    drag.previewWidth = width
    drag.previewHeight = height
    drag.previewX = drag.corner?.includes('w') ? Math.round(drag.token.x + drag.token.width - width) : drag.token.x
    drag.previewY = drag.corner?.includes('n') ? Math.round(drag.token.y + drag.token.height - height) : drag.token.y
    if (element) {
      element.style.left = `${drag.previewX}px`
      element.style.top = `${drag.previewY}px`
      element.style.width = `${drag.previewWidth}px`
      element.style.height = `${drag.previewHeight}px`
    }
  }

  const clearDragStyles = (drag: TokenDragState, revert: boolean) => {
    const element = getTokenElement(drag.token.id)
    if (!element) return
    element.style.zIndex = ''
    if (drag.mode === 'move') {
      element.style.transform = ''
      return
    }
    if (revert) {
      element.style.left = `${drag.token.x}px`
      element.style.top = `${drag.token.y}px`
      element.style.width = `${drag.token.width}px`
      element.style.height = `${drag.token.height}px`
    }
  }

  /** zIndex patch that puts the token above every other token, if it is not already there. */
  const raisePatch = (tokenId: string): TokenPatch => {
    const current = tokensRef.current.find(item => item.id === tokenId)
    if (!current) return {}
    const isTopmost = tokensRef.current.every(item => item.id === tokenId || item.zIndex < current.zIndex)
    if (isTopmost) return {}
    const maxZ = tokensRef.current.reduce((max, item) => Math.max(max, item.zIndex), 0)
    return { zIndex: maxZ + 1 }
  }

  const finishDrag = (drag: TokenDragState, cancelled: boolean) => {
    dragRef.current = null
    drag.cleanup()

    if (cancelled) {
      clearDragStyles(drag, true)
      return
    }

    if (drag.mode === 'move') {
      clearDragStyles(drag, false)
      if (drag.moved) {
        // One commit for position + raise: a single broadcast/DB write, and no
        // list re-sort while the pointer is still captured.
        void patchToken(drag.token.id, {
          x: drag.previewX,
          y: drag.previewY,
          ...raisePatch(drag.token.id),
        })
        return
      }
      // Short tap: select/raise; a second tap within the delay opens the card.
      void bringTokenToFront(drag.token.id)
      const now = performance.now()
      const lastTap = lastTapRef.current
      lastTapRef.current = { tokenId: drag.token.id, at: now }
      if (lastTap.tokenId === drag.token.id && now - lastTap.at <= DOUBLE_TAP_DELAY) {
        lastTapRef.current = { tokenId: '', at: 0 }
        onOpenCharacter(drag.token)
      }
      return
    }

    clearDragStyles(drag, !drag.moved)
    if (drag.moved) {
      void patchToken(drag.token.id, {
        x: drag.previewX,
        y: drag.previewY,
        width: drag.previewWidth,
        height: drag.previewHeight,
      })
    }
  }

  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    token: CharacterToken,
    mode: 'move' | 'resize',
    corner?: 'nw' | 'ne' | 'sw' | 'se',
  ) => {
    if (dragRef.current) return
    event.preventDefault()
    // Best effort: capture keeps events flowing over iframes (video layers).
    // The real drag lifecycle lives on window listeners below, so it survives
    // even if the capture is lost to a mid-drag DOM re-order.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture is an optimization only.
    }

    const pointerId = event.pointerId
    const handleMove = (nativeEvent: globalThis.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || nativeEvent.pointerId !== pointerId) return
      if (!drag.moved) {
        const distance = Math.hypot(
          nativeEvent.clientX - drag.startClientX,
          nativeEvent.clientY - drag.startClientY,
        )
        if (distance < DRAG_THRESHOLD) return
        drag.moved = true
        const element = getTokenElement(drag.token.id)
        if (element) {
          element.style.zIndex = String(DRAG_RAISE_Z)
          element.style.willChange = drag.mode === 'move' ? 'transform' : 'left, top, width, height'
        }
      }
      applyDragPreview(drag, nativeEvent.clientX, nativeEvent.clientY)
    }
    const handleUp = (nativeEvent: globalThis.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || nativeEvent.pointerId !== pointerId) return
      const element = getTokenElement(drag.token.id)
      if (element) element.style.willChange = ''
      finishDrag(drag, false)
    }
    const handleCancel = (nativeEvent: globalThis.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || nativeEvent.pointerId !== pointerId) return
      const element = getTokenElement(drag.token.id)
      if (element) element.style.willChange = ''
      finishDrag(drag, true)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)

    dragRef.current = {
      token,
      mode,
      corner,
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      previewX: token.x,
      previewY: token.y,
      previewWidth: token.width,
      previewHeight: token.height,
      aspectRatio: Math.max(0.01, token.width / token.height),
      cleanup,
    }
  }

  const startTokenPointer = (event: ReactPointerEvent<HTMLElement>, token: CharacterToken) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.stopPropagation()
    setSelectedTokenId(token.id)
    if (!canManageToken(token)) return
    startDrag(event, token, 'move')
  }

  const startTokenResize = (
    event: ReactPointerEvent<HTMLElement>,
    token: CharacterToken,
    corner: 'nw' | 'ne' | 'sw' | 'se',
  ) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    if (!canResizeToken(token)) return
    event.stopPropagation()
    startDrag(event, token, 'resize', corner)
  }

  const renderToken = (token: CharacterToken) => {
    const selected = selectedTokenId === token.id
    const manageable = canManageToken(token)
    const resizable = canResizeToken(token)
    return (
      <div
        key={token.id}
        className={`character-token ${selected ? 'selected' : ''} ${manageable ? 'manageable' : 'foreign'}`}
        data-token-id={token.id}
        style={{
          left: token.x,
          top: token.y,
          width: token.width,
          height: token.height,
          zIndex: token.zIndex,
        }}
        title={token.characterName || undefined}
        onPointerDown={event => startTokenPointer(event, token)}
        onClick={event => event.stopPropagation()}
        onDragStart={event => event.preventDefault()}
      >
        {token.imageUrl ? (
          <img src={token.imageUrl} alt="" draggable={false} />
        ) : (
          <span className="character-token-fallback">{(token.characterName || '?').slice(0, 1).toUpperCase()}</span>
        )}
        {selected ? (
          <span className="character-token-name">{token.characterName || t('Безымянный')}</span>
        ) : null}
        {selected && manageable ? (
          <button
            type="button"
            className="character-token-remove"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation()
              void deleteToken(token.id)
            }}
            title={t('Убрать токен со стола')}
            aria-label={t('Убрать токен со стола')}
          >
            ×
          </button>
        ) : null}
        {selected && resizable ? (
          <>
            {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
              <button
                type="button"
                key={corner}
                className={`resize-handle ${corner}`}
                onPointerDown={event => startTokenResize(event, token, corner)}
                title={t('Изменить размер')}
              />
            ))}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {clipToStage ? (
        <div
          className="token-layer token-layer-clip"
          style={{ zIndex: TOKEN_LAYER_Z, width: sceneBounds.width, height: sceneBounds.height }}
        >
          {tokens.map(renderToken)}
        </div>
      ) : null}
      {!clipToStage ? (
        <div className="token-layer" style={{ zIndex: TOKEN_LAYER_Z }}>
          {tokens.map(renderToken)}
        </div>
      ) : null}
    </>
  )
}
