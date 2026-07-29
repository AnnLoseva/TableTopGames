'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MasterActor } from '@/games/vampires/modules/actors/types'
import type { MasterInverseOperation } from '../types'
import { executeInverseOperation } from '../services'

export type UndoStackEntry = {
  id: string
  summary: string
  inverse: MasterInverseOperation
  createdAt: string
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .ProseMirror, [role="textbox"]'))
}

/**
 * Session undo stack for safely reversible master ops (inverse ops only).
 * Ctrl/Cmd+Z never intercepts while focus is in an editor/input.
 */
export function useMasterUndo(actors: readonly MasterActor[]) {
  const [stack, setStack] = useState<UndoStackEntry[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const actorsRef = useRef(actors)
  actorsRef.current = actors

  const pushUndo = useCallback((entry: Omit<UndoStackEntry, 'id' | 'createdAt'> & { id?: string }) => {
    if (!entry.inverse || entry.inverse.type === 'noop') return
    setStack(prev => [
      {
        id: entry.id || crypto.randomUUID(),
        summary: entry.summary,
        inverse: entry.inverse,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 30))
  }, [])

  const undoLast = useCallback(async () => {
    const top = stack[0]
    if (!top) {
      setStatus('Нечего отменять')
      return
    }
    try {
      await executeInverseOperation(top.inverse, actorsRef.current)
      setStack(prev => prev.slice(1))
      setStatus(`Отменено: ${top.summary}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Undo не удался')
    }
  }, [stack])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() !== 'z' || event.shiftKey) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      void undoLast()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoLast])

  return {
    stack,
    canUndo: stack.length > 0,
    status,
    pushUndo,
    undoLast,
    clearStatus: () => setStatus(null),
  }
}
