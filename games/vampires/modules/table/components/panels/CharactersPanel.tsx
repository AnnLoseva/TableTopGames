'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { fetchCharactersByIds } from '../../api/character-api'
import { searchCharactersByName } from '../../api/controller-api'
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
  controllers: CharacterController[]
  roomParticipants: ActiveParticipant[]
  tokens: CharacterToken[]
  onAddToken: (entry: CharacterListEntry) => void
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
  const [searchDraft, setSearchDraft] = useState('')
  const [searchResults, setSearchResults] = useState<CharacterListEntry[]>([])
  const [searchStatus, setSearchStatus] = useState('')

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

  const runSearch = async () => {
    setSearchStatus(t('Ищу персонажей...'))
    const { rows, error } = await searchCharactersByName(searchDraft)
    if (error) {
      console.error('Не удалось найти персонажей:', error)
      setSearchStatus(t('Поиск не удался.'))
      return
    }
    setSearchResults((rows as CharacterRow[]).map(rowToEntry))
    setSearchStatus(rows.length === 0 ? t('Ничего не нашлось.') : '')
  }

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
        <span>{entries.length}</span>
      </header>
      {!chatUser ? (
        <p className="panel-empty">{t('Войди на главной, чтобы увидеть своих персонажей.')}</p>
      ) : entries.length === 0 ? (
        <p className="panel-empty">
          {isMaster ? t('Персонажи появятся, когда игроки подключатся.') : t('Тебе пока не назначены персонажи.')}
        </p>
      ) : (
        <div className="characters-panel-list">{entries.map(renderEntry)}</div>
      )}
      {isMaster ? (
        <div className="characters-panel-search">
          <form
            className="media-url-form"
            onSubmit={event => {
              event.preventDefault()
              void runSearch()
            }}
          >
            <input
              value={searchDraft}
              onChange={event => setSearchDraft(event.target.value)}
              placeholder={t('Поиск персонажа по имени')}
            />
            <button type="submit">{t('Найти')}</button>
          </form>
          {searchStatus ? <p className="panel-empty">{searchStatus}</p> : null}
          {searchResults.length > 0 ? (
            <div className="characters-panel-list">
              {searchResults.filter(entry => !knownIds.has(entry.id)).map(renderEntry)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
