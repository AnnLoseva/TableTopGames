import { useState } from 'react'
import {
  getStoredMasterPassword,
  setStoredMasterPassword,
} from '@/games/vampires/modules/table/utils/room-session'
import type { MasterDisplayMode } from '../multi-window/types'

function MasterPasswordControl() {
  const [draft, setDraft] = useState(() => getStoredMasterPassword())
  const [saved, setSaved] = useState(false)

  return (
    <label className="master-console-password-control">
      <span>Пароль мастера</span>
      <input
        value={draft}
        onChange={event => {
          setDraft(event.target.value)
          setSaved(false)
        }}
        aria-label="Пароль мастера"
      />
      <button
        type="button"
        onClick={() => {
          setStoredMasterPassword(draft)
          setSaved(true)
        }}
      >
        {saved ? 'Сохранено' : 'Сменить'}
      </button>
    </label>
  )
}

type MasterConsoleTopbarProps = {
  room: string
  onLock: () => void
  onOpenSearch?: () => void
  statusMessage?: string | null
  display?: MasterDisplayMode
  peerCount?: number
  onOpenDetached?: () => void
  layoutName?: string | null
  onSaveLayout?: () => void
}

export default function MasterConsoleTopbar({
  room,
  onLock,
  onOpenSearch,
  statusMessage,
  display = 'primary',
  peerCount = 0,
  onOpenDetached,
  layoutName,
  onSaveLayout,
}: MasterConsoleTopbarProps) {
  const detached = display === 'detached'

  return (
    <header className="master-console-topbar">
      <div>
        <span>
          {detached ? 'Пульт · detached' : 'Пульт рассказчика · V5'}
        </span>
        <strong>{room}</strong>
        {layoutName ? <em className="master-console-topbar-status">layout: {layoutName}</em> : null}
        {statusMessage ? (
          <em className="master-console-topbar-status" title={statusMessage}>
            {statusMessage}
          </em>
        ) : null}
      </div>
      <div className="master-console-statuses" aria-label="Состояние пульта">
        <button
          type="button"
          className="master-console-search-btn"
          onClick={onOpenSearch}
          title="Поиск и команды (⌘K / Ctrl+K)"
        >
          ⌕ Поиск
          <kbd>⌘K</kbd>
        </button>
        {!detached ? (
          <button
            type="button"
            className="master-console-search-btn"
            onClick={onOpenDetached}
            title="Открыть текущий модуль в отдельном окне"
          >
            ⧉ Окно
          </button>
        ) : null}
        {onSaveLayout ? (
          <button
            type="button"
            className="master-console-search-btn"
            onClick={onSaveLayout}
            title="Сохранить раскладку"
          >
            ⊡ Layout
          </button>
        ) : null}
        <span className="master-console-sync">
          ● {peerCount > 0 ? `${peerCount + 1} окна` : '1 окно'}
        </span>
        <span className="master-console-role">{detached ? 'Detached' : 'Мастер'}</span>
        {!detached ? <MasterPasswordControl /> : null}
        <button type="button" onClick={onLock}>Заблокировать</button>
      </div>
    </header>
  )
}
