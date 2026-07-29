'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildBuiltInCommands,
  collectAllCommands,
  collectSearchProviders,
  entityTypeLabel,
  filterCommands,
  highlightTitle,
  loadRecentHits,
  loadSearchHistory,
  navigateMasterDeepLink,
  pushRecentHit,
  pushSearchHistory,
  runMasterSearch,
  type MasterCommand,
  type MasterSearchHit,
  type MasterSearchRole,
} from '../search'
import './master-palette.css'

type MasterCommandPaletteProps = {
  room: string
  role?: MasterSearchRole
  open: boolean
  onClose: () => void
  onOpenRoller?: () => void
  onStatus?: (message: string) => void
}

type FlatRow =
  | { key: string; kind: 'header'; label: string }
  | { key: string; kind: 'hit'; hit: MasterSearchHit }
  | { key: string; kind: 'command'; command: MasterCommand }
  | { key: string; kind: 'history'; query: string }

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  if (target.closest('.tiptap, .ProseMirror, [contenteditable="true"], .je-content')) return true
  return false
}

export default function MasterCommandPalette({
  room,
  role = 'master',
  open,
  onClose,
  onOpenRoller,
  onStatus,
}: MasterCommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<MasterSearchHit[]>([])
  const [groups, setGroups] = useState<{ id: string; label: string; hits: readonly MasterSearchHit[] }[]>([])
  const [commands, setCommands] = useState<MasterCommand[]>([])
  const [recent, setRecent] = useState<MasterSearchHit[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [pendingDangerous, setPendingDangerous] = useState<MasterCommand | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const providers = useMemo(() => collectSearchProviders(), [])
  const builtIn = useMemo(() => buildBuiltInCommands(), [])

  const commandMode = query.trim().startsWith('>')
  const searchQuery = commandMode ? query.trim().replace(/^>\s*/, '') : query

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    setPendingDangerous(null)
    setError(null)
    setRecent(loadRecentHits(room))
    setHistory(loadSearchHistory(room))
    void collectAllCommands({ room, role }, builtIn).then(setCommands)
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open, room, role, builtIn])

  useEffect(() => {
    if (!open) return
    if (commandMode) {
      setHits([])
      setGroups([])
      setLoading(false)
      return
    }
    const q = searchQuery.trim()
    if (q.length < 1) {
      setHits([])
      setGroups([])
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    const timer = window.setTimeout(() => {
      void runMasterSearch(providers, {
        room,
        role,
        query: q,
        signal: controller.signal,
        limit: 6,
      }).then(result => {
        if (controller.signal.aborted) return
        setGroups([...result.groups])
        setHits(result.hits)
        setLoading(false)
        setError(result.error || null)
      }).catch(err => {
        if (controller.signal.aborted) return
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Ошибка поиска')
      })
    }, 120)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, commandMode, searchQuery, providers, room, role])

  const matchedCommands = useMemo(() => {
    if (!open) return []
    if (commandMode) return filterCommands(commands, searchQuery)
    if (!searchQuery.trim()) return commands.slice(0, 8)
    return filterCommands(commands, searchQuery).slice(0, 6)
  }, [open, commandMode, commands, searchQuery])

  const rows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = []
    if (pendingDangerous) return out

    if (!searchQuery.trim() && !commandMode) {
      if (recent.length) {
        out.push({ key: 'h-recent', kind: 'header', label: 'Недавние' })
        recent.forEach(hit => out.push({ key: `recent:${hit.id}`, kind: 'hit', hit }))
      }
      if (history.length) {
        out.push({ key: 'h-history', kind: 'header', label: 'История поиска' })
        history.forEach(item => out.push({ key: `hist:${item}`, kind: 'history', query: item }))
      }
      out.push({ key: 'h-cmd', kind: 'header', label: 'Команды' })
      matchedCommands.forEach(command => {
        out.push({ key: `cmd:${command.id}`, kind: 'command', command })
      })
      return out
    }

    if (commandMode) {
      out.push({ key: 'h-cmd-mode', kind: 'header', label: 'Команды' })
      matchedCommands.forEach(command => {
        out.push({ key: `cmd:${command.id}`, kind: 'command', command })
      })
      return out
    }

    groups.forEach(group => {
      out.push({ key: `h:${group.id}`, kind: 'header', label: group.label })
      group.hits.forEach(hit => out.push({ key: hit.id, kind: 'hit', hit }))
    })
    if (matchedCommands.length) {
      out.push({ key: 'h-cmd-match', kind: 'header', label: 'Команды' })
      matchedCommands.forEach(command => {
        out.push({ key: `cmd:${command.id}`, kind: 'command', command })
      })
    }
    return out
  }, [pendingDangerous, searchQuery, commandMode, recent, history, matchedCommands, groups])

  const selectable = useMemo(
    () => rows.filter(row => row.kind !== 'header') as Exclude<FlatRow, { kind: 'header' }>[],
    [rows],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query, groups, matchedCommands, pendingDangerous])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const runCommand = useCallback(async (command: MasterCommand) => {
    if (command.dangerous) {
      setPendingDangerous(command)
      return
    }
    const ctx = {
      room,
      role,
      navigate: (target: Parameters<typeof navigateMasterDeepLink>[0]) => {
        navigateMasterDeepLink({ ...target, room })
      },
      openRoller: () => onOpenRoller?.(),
      confirm: async (message: string) => window.confirm(message),
      setStatus: onStatus,
    }
    try {
      await command.run(ctx)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Команда не выполнена')
    }
  }, [room, role, onOpenRoller, onStatus, onClose])

  const openHit = useCallback((hit: MasterSearchHit) => {
    pushRecentHit(room, hit)
    if (searchQuery.trim()) pushSearchHistory(room, searchQuery)
    navigateMasterDeepLink({
      room,
      moduleId: hit.moduleId,
      entityId: hit.entityId,
      entityType: hit.entityType,
      extras: hit.deepLinkKey ? { [hit.deepLinkKey]: hit.entityId } : undefined,
    })
    onClose()
  }, [room, searchQuery, onClose])

  const activateRow = useCallback((row: Exclude<FlatRow, { kind: 'header' }>) => {
    if (row.kind === 'hit') openHit(row.hit)
    else if (row.kind === 'command') void runCommand(row.command)
    else if (row.kind === 'history') setQuery(row.query)
  }, [openHit, runCommand])

  const confirmDangerous = useCallback(async () => {
    if (!pendingDangerous) return
    const command = pendingDangerous
    setPendingDangerous(null)
    const ctx = {
      room,
      role,
      navigate: (target: Parameters<typeof navigateMasterDeepLink>[0]) => {
        navigateMasterDeepLink({ ...target, room })
      },
      openRoller: () => onOpenRoller?.(),
      confirm: async () => true,
      setStatus: onStatus,
    }
    try {
      await command.run(ctx)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Команда не выполнена')
    }
  }, [pendingDangerous, room, role, onOpenRoller, onStatus, onClose])

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (pendingDangerous) {
        setPendingDangerous(null)
        return
      }
      onClose()
      return
    }
    if (pendingDangerous) {
      if (event.key === 'Enter') {
        event.preventDefault()
        void confirmDangerous()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(selectable.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = selectable[activeIndex]
      if (row) activateRow(row)
    }
  }, [pendingDangerous, onClose, confirmDangerous, selectable, activeIndex, activateRow])

  if (!open) return null

  let selectCursor = -1

  return (
    <div className="master-palette-root" role="dialog" aria-modal="true" aria-label="Поиск и команды">
      <button type="button" className="master-palette-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="master-palette" onKeyDown={onKeyDown}>
        <div className="master-palette-input-row">
          <span className="master-palette-icon" aria-hidden>⌕</span>
          <input
            ref={inputRef}
            className="master-palette-input"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Поиск сущностей…  ·  > команды  ·  ↑↓ Enter Esc"
            aria-label="Глобальный поиск"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? <span className="master-palette-loading">…</span> : null}
          <kbd className="master-palette-kbd">esc</kbd>
        </div>

        {error ? <p className="master-palette-error">{error}</p> : null}

        {pendingDangerous ? (
          <div className="master-palette-confirm" role="alertdialog" aria-label="Подтверждение">
            <strong>Опасная команда</strong>
            <p>{pendingDangerous.confirmMessage || `Выполнить «${pendingDangerous.title}»?`}</p>
            <div className="master-palette-confirm-actions">
              <button type="button" className="master-palette-btn" data-danger="true" onClick={() => void confirmDangerous()}>
                Подтвердить
              </button>
              <button type="button" className="master-palette-btn" onClick={() => setPendingDangerous(null)}>
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="master-palette-list" ref={listRef} role="listbox">
            {rows.length === 0 ? (
              <div className="master-palette-empty">
                {loading ? 'Ищем…' : searchQuery.trim() ? 'Ничего не найдено' : 'Начните ввод или выберите команду'}
              </div>
            ) : null}
            {rows.map(row => {
              if (row.kind === 'header') {
                return (
                  <div key={row.key} className="master-palette-group-label">
                    {row.label}
                  </div>
                )
              }
              selectCursor += 1
              const idx = selectCursor
              const active = idx === activeIndex
              if (row.kind === 'history') {
                return (
                  <button
                    key={row.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-idx={idx}
                    data-active={active ? 'true' : undefined}
                    className="master-palette-row"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => setQuery(row.query)}
                  >
                    <span className="master-palette-row-icon">◷</span>
                    <span className="master-palette-row-main">
                      <strong>{row.query}</strong>
                      <small>из истории</small>
                    </span>
                  </button>
                )
              }
              if (row.kind === 'command') {
                return (
                  <button
                    key={row.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-idx={idx}
                    data-active={active ? 'true' : undefined}
                    className="master-palette-row"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => void runCommand(row.command)}
                  >
                    <span className="master-palette-row-icon">{row.command.icon || '›'}</span>
                    <span className="master-palette-row-main">
                      <strong>{row.command.title}</strong>
                      <small>{row.command.subtitle || row.command.group}</small>
                    </span>
                    {row.command.dangerous ? (
                      <span className="master-palette-badge" data-tone="danger">!</span>
                    ) : (
                      <span className="master-palette-type">cmd</span>
                    )}
                  </button>
                )
              }
              const parts = highlightTitle(row.hit.title, row.hit.matchRanges)
              return (
                <button
                  key={row.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-idx={idx}
                  data-active={active ? 'true' : undefined}
                  className="master-palette-row"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => openHit(row.hit)}
                >
                  <span className="master-palette-row-icon">{row.hit.icon || '•'}</span>
                  <span className="master-palette-row-main">
                    <strong>
                      {parts.map((part, i) => (
                        part.highlight
                          ? <mark key={i}>{part.text}</mark>
                          : <span key={i}>{part.text}</span>
                      ))}
                    </strong>
                    <small>{row.hit.subtitle || entityTypeLabel(row.hit.entityType)}</small>
                  </span>
                  {row.hit.isPrivate ? (
                    <span className="master-palette-badge" data-tone="private">☾ private</span>
                  ) : null}
                  <span className="master-palette-type">{entityTypeLabel(row.hit.entityType)}</span>
                </button>
              )
            })}
          </div>
        )}

        <footer className="master-palette-footer">
          <span>↑↓ навигация</span>
          <span>↵ открыть</span>
          <span>esc закрыть</span>
          <span>{'>'} команды</span>
        </footer>
      </div>
    </div>
  )
}

/** Global shortcut helper — ignores plain typing; Cmd/Ctrl+K opens even in editors (preventDefault). */
export function shouldHandleSearchShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  if (key !== 'k') return false
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false
  // Always handle Cmd/Ctrl+K for palette (prevent browser/editor default).
  // Do NOT open on bare K inside editors.
  return true
}

export { isEditableTarget }
