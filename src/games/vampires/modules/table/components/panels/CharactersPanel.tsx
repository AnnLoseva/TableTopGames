'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { fetchCharactersByIds } from '../../api/character-api'
import type {
  ActiveParticipant,
  CharacterController,
  CharacterRow,
  CharacterToken,
} from '../../types'

export type CharacterListEntry = {
  id: string
  name: string
  clan: string | null
  image: string
  userId?: string
  username?: string
}

function rowToEntry(row: CharacterRow): CharacterListEntry {
  const data = row.data || {}
  return {
    id: row.id,
    name: row.name,
    clan: row.clan,
    image: data.characterImage || data.image || data.portrait || '',
    userId: row.user_id || undefined,
  }
}

export type CharactersPanelProps = {
  isMaster: boolean
  chatUser: ChatUser | null
  /** Own characters (player and master) + active characters of participants (master). */
  baseEntries: CharacterListEntry[]
  /** Characters known only from control assignments; fetched lazily by id. */
  extraCharacterIds: string[]
  /** Full account library shown in the master's add-character gallery. */
  availableEntries?: CharacterListEntry[]
  newCharacterHref?: string
  controllers: CharacterController[]
  roomParticipants: ActiveParticipant[]
  tokens: CharacterToken[]
  onAddToken: (entry: CharacterListEntry) => void | Promise<unknown>
  onFindToken: (characterId: string) => void
  onOpenCharacter: (entry: CharacterListEntry) => void
  assignCharacter?: (characterId: string, userId: string) => Promise<void>
  unassignController?: (controllerId: string) => Promise<void>
}

export default function CharactersPanel({
  isMaster,
  chatUser,
  baseEntries,
  extraCharacterIds,
  availableEntries = [],
  newCharacterHref,
  controllers,
  roomParticipants,
  tokens,
  onAddToken,
  onFindToken,
  onOpenCharacter,
  assignCharacter,
  unassignController,
}: CharactersPanelProps) {
  const { t } = useLang()
  const [fetchedEntries, setFetchedEntries] = useState<CharacterListEntry[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [gallerySelection, setGallerySelection] = useState<Set<string>>(new Set())
  const [addingFromGallery, setAddingFromGallery] = useState(false)

  const knownIds = useMemo(
    () => new Set([...baseEntries.map(entry => entry.id), ...fetchedEntries.map(entry => entry.id)]),
    [baseEntries, fetchedEntries],
  )

  useEffect(() => {
    const missing = extraCharacterIds.filter(id => !knownIds.has(id))
    if (missing.length === 0) return
    let cancelled = false
    void fetchCharactersByIds(missing).then(({ rows, error }) => {
      if (cancelled || error) return
      setFetchedEntries(prev => {
        const present = new Set(prev.map(entry => entry.id))
        const added = rows.filter(row => !present.has(row.id)).map(rowToEntry)
        return added.length ? [...prev, ...added] : prev
      })
    })
    return () => {
      cancelled = true
    }
  }, [extraCharacterIds, knownIds])

  const entries = useMemo(() => {
    const map = new Map<string, CharacterListEntry>()
    baseEntries.forEach(entry => map.set(entry.id, entry))
    fetchedEntries.forEach(entry => {
      if (extraCharacterIds.includes(entry.id) && !map.has(entry.id)) map.set(entry.id, entry)
    })
    return [...map.values()]
  }, [baseEntries, fetchedEntries, extraCharacterIds])

  const tokensByCharacter = useMemo(() => {
    const map = new Map<string, CharacterToken>()
    tokens.forEach(token => {
      if (!map.has(token.characterId)) map.set(token.characterId, token)
    })
    return map
  }, [tokens])

  const controllersByCharacter = useMemo(() => {
    const map = new Map<string, CharacterController[]>()
    controllers.forEach(controller => {
      map.set(controller.characterId, [...(map.get(controller.characterId) || []), controller])
    })
    return map
  }, [controllers])

  const participantName = (userId: string) =>
    roomParticipants.find(participant => participant.userId === userId)?.username || userId.slice(0, 8)

  const renderEntry = (entry: CharacterListEntry) => {
    const token = tokensByCharacter.get(entry.id)
    const assigned = controllersByCharacter.get(entry.id) || []
    return (
      <article className="characters-panel-row" key={entry.id}>
        <span className="chat-avatar" aria-hidden="true">
          {entry.image ? <img src={entry.image} alt="" /> : <i>{(entry.name || '?').slice(0, 1).toUpperCase()}</i>}
        </span>
        <div className="characters-panel-info">
          <strong>{entry.name || t('Безымянный')}</strong>
          <small>
            {entry.clan || t('без клана')}
            {token ? ` · ${t('на столе')}` : ''}
          </small>
          {isMaster && assigned.length > 0 ? (
            <span className="characters-panel-assignments">
              {assigned.map(controller => (
                <button
                  type="button"
                  key={controller.id}
                  className="characters-panel-assignment"
                  onClick={() => unassignController && void unassignController(controller.id)}
                  title={t('Снять назначение')}
                >
                  {participantName(controller.userId)} ×
                </button>
              ))}
            </span>
          ) : null}
        </div>
        <div className="characters-panel-actions">
          {token ? (
            <button type="button" onClick={() => onFindToken(entry.id)}>{t('Найти')}</button>
          ) : (
            <button type="button" onClick={() => onAddToken(entry)}>{t('На стол')}</button>
          )}
          <button type="button" onClick={() => onOpenCharacter(entry)}>{t('Карточка')}</button>
          {isMaster && assignCharacter ? (
            <select
              value=""
              onChange={event => {
                const userId = event.target.value
                if (userId) void assignCharacter(entry.id, userId)
              }}
              title={t('Назначить игрока')}
            >
              <option value="">{t('Назначить...')}</option>
              {roomParticipants.map(participant => (
                <option value={participant.userId} key={participant.userId}>
                  {participant.username}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </article>
    )
  }

  return (
    <div className="characters-panel">
      <header>
        <strong>{isMaster ? t('Персонажи') : t('Мои персонажи')}</strong>
        <div>
          <span>{entries.length}</span>
          {isMaster ? (
            <button type="button" onClick={() => {
              setGallerySelection(new Set())
              setGalleryOpen(true)
            }}>
              {t('Добавить персонажа')}
            </button>
          ) : null}
        </div>
      </header>
      {!chatUser ? (
        <p className="panel-empty">{t('Войди на главной, чтобы увидеть своих персонажей.')}</p>
      ) : entries.length === 0 ? (
        <p className="panel-empty">
          {isMaster ? t('Добавьте персонажей мастера на эту сцену.') : t('Тебе пока не назначены персонажи.')}
        </p>
      ) : (
        <div className="characters-panel-list">{entries.map(renderEntry)}</div>
      )}
      {galleryOpen ? (
        <div className="character-gallery-dialog" role="dialog" aria-modal="true" aria-label={t('Галерея персонажей')} onMouseDown={() => setGalleryOpen(false)}>
          <section onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{t('Персонажи мастера')}</span>
                <strong>{t('Добавить на сцену')}</strong>
              </div>
              <button type="button" onClick={() => setGalleryOpen(false)} aria-label={t('Закрыть')}>×</button>
            </header>
            <div className="character-gallery-toolbar">
              <button type="button" onClick={() => {
                setGallerySelection(current => current.size === availableEntries.length
                  ? new Set()
                  : new Set(availableEntries.map(entry => entry.id)))
              }} disabled={availableEntries.length === 0}>
                {gallerySelection.size === availableEntries.length && availableEntries.length > 0
                  ? t('Снять выделение')
                  : t('Выделить всех')}
              </button>
              {newCharacterHref ? (
                <a href={newCharacterHref} target="_blank" rel="noreferrer">{t('Создать нового персонажа')}</a>
              ) : null}
            </div>
            {availableEntries.length === 0 ? (
              <p className="panel-empty">{t('Сохранённых персонажей пока нет.')}</p>
            ) : (
              <div className="character-gallery-grid">
                {availableEntries.map(entry => {
                  const selected = gallerySelection.has(entry.id)
                  const alreadyOnTable = tokensByCharacter.has(entry.id)
                  return (
                    <button
                      type="button"
                      className={selected ? 'selected' : ''}
                      key={entry.id}
                      onClick={() => setGallerySelection(current => {
                        const next = new Set(current)
                        if (next.has(entry.id)) next.delete(entry.id)
                        else next.add(entry.id)
                        return next
                      })}
                    >
                      <span className="chat-avatar" aria-hidden="true">
                        {entry.image ? <img src={entry.image} alt="" /> : <i>{(entry.name || '?').slice(0, 1).toUpperCase()}</i>}
                      </span>
                      <span>
                        <strong>{entry.name || t('Безымянный')}</strong>
                        <small>{entry.clan || t('без клана')}{alreadyOnTable ? ` · ${t('на столе')}` : ''}</small>
                      </span>
                      <i aria-hidden="true">{selected ? '✓' : ''}</i>
                    </button>
                  )
                })}
              </div>
            )}
            <footer>
              <span>{t('Выбрано')}: {gallerySelection.size}</span>
              <button
                type="button"
                disabled={gallerySelection.size === 0 || addingFromGallery}
                onClick={() => {
                  setAddingFromGallery(true)
                  void (async () => {
                    for (const entry of availableEntries) {
                      if (gallerySelection.has(entry.id)) await onAddToken(entry)
                    }
                    setAddingFromGallery(false)
                    setGalleryOpen(false)
                  })()
                }}
              >
                {addingFromGallery ? t('Добавляю...') : t('Добавить выбранных')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
}
