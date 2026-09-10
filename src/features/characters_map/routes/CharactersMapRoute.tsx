'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAccount } from '@/platform/account/AccountProvider'
import {
  createCharacter,
  deleteCharacter,
  getCharacterImageUrl,
  listCharacters,
  removeCharacterImageFile,
  updateCharacter,
  uploadCharacterImage,
} from '../api/charactersApi'
import {
  createRelationship,
  deleteRelationship,
  listRelationships,
  updateRelationship,
} from '../api/relationshipsApi'
import { CHARACTERS_MAP_OWNER_AUTH_USER_ID, createDefaultCharacterSheet } from '../constants'
import { exportCharactersMapToText } from '../export'
import { createCharactersMapClient } from '../supabase'
import { collectTimelineMarks, computeTimelineBounds } from '../timeline'
import type { CharacterSheet, GalleryItem, MapCharacter, MapRelationship, RelationshipEvent, RelationshipKind } from '../types'
import AddCharacterModal from '../components/AddCharacterModal'
import AddRelationshipModal from '../components/AddRelationshipModal'
import CharacterPanel from '../components/CharacterPanel'
import CharacterRosterModal from '../components/CharacterRosterModal'
import ExportModal from '../components/ExportModal'
import MapCanvas from '../components/MapCanvas'
import RelationshipPanel from '../components/RelationshipPanel'
import TimelineControl from '../components/TimelineControl'
import styles from './CharactersMapRoute.module.css'

function randomSpawnPosition(index: number): { x: number; y: number } {
  const angle = (index % 8) * (Math.PI / 4)
  const ring = Math.floor(index / 8) + 1
  const radius = 160 * ring
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

const EDIT_MODE_STORAGE_KEY = 'characters-map-edit-mode'

export default function CharactersMapRoute() {
  const { isReady: isAccountReady } = useAccount()
  const client = useMemo(() => createCharactersMapClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [characters, setCharacters] = useState<MapCharacter[]>([])
  const [relationships, setRelationships] = useState<MapRelationship[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null)
  const [showAddCharacter, setShowAddCharacter] = useState(false)
  const [relationshipDraft, setRelationshipDraft] = useState<{ fromId: string | null; toId: string | null } | null>(null)
  const [didReadInitialParams, setDidReadInitialParams] = useState(false)
  const [editModeOn, setEditModeOn] = useState(true)
  const [showExport, setShowExport] = useState(false)
  const [showRoster, setShowRoster] = useState(false)
  const [timelineYear, setTimelineYear] = useState<number | null>(null)

  const isOwner = authUserId === CHARACTERS_MAP_OWNER_AUTH_USER_ID
  const isEditor = isOwner && editModeOn

  useEffect(() => {
    let cancelled = false
    client.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthUserId(data.user?.id ?? null)
    })
    return () => { cancelled = true }
  }, [client, isAccountReady])

  useEffect(() => {
    const stored = window.localStorage.getItem(EDIT_MODE_STORAGE_KEY)
    if (stored === 'off') setEditModeOn(false)
  }, [])

  const toggleEditMode = useCallback(() => {
    setEditModeOn(previous => {
      const next = !previous
      window.localStorage.setItem(EDIT_MODE_STORAGE_KEY, next ? 'on' : 'off')
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    Promise.all([listCharacters(client), listRelationships(client)])
      .then(([loadedCharacters, loadedRelationships]) => {
        if (cancelled) return
        setCharacters(loadedCharacters)
        setRelationships(loadedRelationships)
      })
      .catch(error => {
        if (cancelled) return
        console.error('Не удалось загрузить карту персонажей:', error)
        setLoadError('Не удалось загрузить карту. Попробуйте обновить страницу.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    if (didReadInitialParams || isLoading) return
    const charParam = searchParams.get('char')
    const relParam = searchParams.get('rel')
    if (charParam) setSelectedCharacterId(charParam)
    else if (relParam) setSelectedRelationshipId(relParam)
    setDidReadInitialParams(true)
  }, [didReadInitialParams, isLoading, searchParams])

  const updateUrl = useCallback((characterId: string | null, relationshipId: string | null) => {
    const params = new URLSearchParams()
    if (characterId) params.set('char', characterId)
    else if (relationshipId) params.set('rel', relationshipId)
    const query = params.toString()
    router.replace(query ? `/characters_map?${query}` : '/characters_map', { scroll: false })
  }, [router])

  const selectCharacter = useCallback((id: string | null) => {
    setSelectedCharacterId(id)
    if (id) setSelectedRelationshipId(null)
    updateUrl(id, null)
  }, [updateUrl])

  const selectRelationship = useCallback((id: string | null) => {
    setSelectedRelationshipId(id)
    if (id) setSelectedCharacterId(null)
    updateUrl(null, id)
  }, [updateUrl])

  const getImageUrl = useCallback((imagePath: string) => getCharacterImageUrl(client, imagePath), [client])

  const handleCreateCharacter = useCallback(async (input: { name: string; description: string; file: File | null }) => {
    let imagePath: string | null = null
    if (input.file) imagePath = await uploadCharacterImage(client, input.file)
    const spawn = randomSpawnPosition(characters.length)
    const created = await createCharacter(client, {
      name: input.name,
      description: input.description,
      imagePath,
      positionX: spawn.x,
      positionY: spawn.y,
      sheet: createDefaultCharacterSheet(),
    })
    setCharacters(previous => [...previous, created])
  }, [client, characters.length])

  const handleMoveCharacter = useCallback((id: string, x: number, y: number) => {
    setCharacters(previous => previous.map(character => (
      character.id === id ? { ...character, positionX: x, positionY: y } : character
    )))
    updateCharacter(client, id, { positionX: x, positionY: y }).catch(error => {
      console.error('Не удалось сохранить позицию персонажа:', error)
    })
  }, [client])

  const handleSaveCharacter = useCallback(async (id: string, patch: { name: string; description: string; sheet: CharacterSheet }) => {
    const updated = await updateCharacter(client, id, patch)
    setCharacters(previous => previous.map(character => (character.id === id ? updated : character)))
  }, [client])

  const handleUploadCharacterImage = useCallback(async (character: MapCharacter, file: File) => {
    const newPath = await uploadCharacterImage(client, file)
    const updated = await updateCharacter(client, character.id, { imagePath: newPath })
    setCharacters(previous => previous.map(item => (item.id === character.id ? updated : item)))
    if (character.imagePath) await removeCharacterImageFile(client, character.imagePath)
  }, [client])

  const handleAddGalleryItem = useCallback(async (character: MapCharacter, file: File) => {
    const imagePath = await uploadCharacterImage(client, file)
    const item: GalleryItem = { id: crypto.randomUUID(), imagePath, caption: '', category: 'other' }
    const updated = await updateCharacter(client, character.id, {
      sheet: { ...character.sheet, gallery: [...character.sheet.gallery, item] },
    })
    setCharacters(previous => previous.map(item2 => (item2.id === character.id ? updated : item2)))
  }, [client])

  const handleUpdateGalleryItem = useCallback(async (
    character: MapCharacter,
    itemId: string,
    patch: Partial<Pick<GalleryItem, 'caption' | 'category'>>,
  ) => {
    const gallery = character.sheet.gallery.map(item => (item.id === itemId ? { ...item, ...patch } : item))
    const updated = await updateCharacter(client, character.id, { sheet: { ...character.sheet, gallery } })
    setCharacters(previous => previous.map(item => (item.id === character.id ? updated : item)))
  }, [client])

  const handleRemoveGalleryItem = useCallback(async (character: MapCharacter, itemId: string) => {
    const removed = character.sheet.gallery.find(item => item.id === itemId)
    const gallery = character.sheet.gallery.filter(item => item.id !== itemId)
    const updated = await updateCharacter(client, character.id, { sheet: { ...character.sheet, gallery } })
    setCharacters(previous => previous.map(item => (item.id === character.id ? updated : item)))
    if (removed) await removeCharacterImageFile(client, removed.imagePath)
  }, [client])

  const handleDeleteCharacter = useCallback(async (character: MapCharacter) => {
    await deleteCharacter(client, character)
    setCharacters(previous => previous.filter(item => item.id !== character.id))
    setRelationships(previous => previous.filter(
      relationship => relationship.fromCharacterId !== character.id && relationship.toCharacterId !== character.id,
    ))
    selectCharacter(null)
  }, [client, selectCharacter])

  const handleCreateRelationship = useCallback(async (input: {
    fromCharacterId: string
    toCharacterId: string
    kind: RelationshipKind
    label: string
    description: string
    color: string
  }) => {
    const created = await createRelationship(client, input, relationships.length)
    setRelationships(previous => [...previous, created])
  }, [client, relationships.length])

  const handleSaveRelationship = useCallback(async (id: string, patch: {
    label: string
    description: string
    color: string
    kind: RelationshipKind
    events: RelationshipEvent[]
  }) => {
    const updated = await updateRelationship(client, id, patch)
    setRelationships(previous => previous.map(relationship => (relationship.id === id ? updated : relationship)))
  }, [client])

  const handleConnectRequest = useCallback((fromId: string, toId: string) => {
    setRelationshipDraft({ fromId, toId })
  }, [])

  const handleDeleteRelationship = useCallback(async (id: string) => {
    await deleteRelationship(client, id)
    setRelationships(previous => previous.filter(relationship => relationship.id !== id))
    selectRelationship(null)
  }, [client, selectRelationship])

  const selectedCharacter = characters.find(character => character.id === selectedCharacterId) ?? null
  const selectedRelationship = relationships.find(relationship => relationship.id === selectedRelationshipId) ?? null
  const relationshipFrom = selectedRelationship
    ? characters.find(character => character.id === selectedRelationship.fromCharacterId)
    : null
  const relationshipTo = selectedRelationship
    ? characters.find(character => character.id === selectedRelationship.toCharacterId)
    : null
  const exportText = useMemo(() => exportCharactersMapToText(characters, relationships), [characters, relationships])
  const timelineBounds = useMemo(() => computeTimelineBounds(characters, relationships), [characters, relationships])
  const timelineMarks = useMemo(() => collectTimelineMarks(characters, relationships), [characters, relationships])

  // Once any timeline data exists, default the view to "present" (the latest known
  // year) — everyone born so far, in their current state. Only fires while the
  // year hasn't been touched yet, so it never fights a year the user picked.
  useEffect(() => {
    if (timelineYear === null && timelineBounds) setTimelineYear(timelineBounds.max)
  }, [timelineBounds, timelineYear])

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Карта персонажей</h1>
          <p className={styles.subtitle}>
            {isEditor ? 'Режим редактирования' : !isAccountReady ? 'Проверяю аккаунт…' : 'Режим просмотра'}
          </p>
        </div>
        <div className={styles.actions}>
          {characters.length > 0 && (
            <button type="button" className={styles.addButton} onClick={() => setShowExport(true)}>
              Экспорт
            </button>
          )}
          {isOwner && (
            <>
              <button type="button" className={styles.addButton} onClick={toggleEditMode}>
                {isEditor ? 'Режим просмотра' : 'Режим редактирования'}
              </button>
              {isEditor && (
                <>
                  <button type="button" className={styles.addButton} onClick={() => setShowAddCharacter(true)}>
                    + Персонаж
                  </button>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => setRelationshipDraft({ fromId: selectedCharacterId, toId: null })}
                    disabled={characters.length < 2}
                  >
                    + Связь
                  </button>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => setShowRoster(true)}
                    disabled={characters.length === 0}
                  >
                    Все персонажи
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {actionError && <div className={styles.errorBanner}>{actionError}</div>}

      {isLoading && <div className={styles.centerMessage}>Загружаю карту…</div>}
      {!isLoading && loadError && <div className={styles.centerMessage}>{loadError}</div>}
      {!isLoading && !loadError && characters.length === 0 && (
        <div className={styles.centerMessage}>
          {isEditor
            ? 'Персонажей пока нет. Нажмите «+ Персонаж», чтобы добавить первого.'
            : 'На карте пока нет персонажей.'}
        </div>
      )}

      {!isLoading && !loadError && characters.length > 0 && (
        <MapCanvas
          characters={characters}
          relationships={relationships}
          isEditor={isEditor}
          timelineYear={timelineYear}
          selectedCharacterId={selectedCharacterId}
          selectedRelationshipId={selectedRelationshipId}
          onSelectCharacter={selectCharacter}
          onSelectRelationship={selectRelationship}
          onMoveCharacter={handleMoveCharacter}
          onCreateRelationshipRequest={handleConnectRequest}
          getImageUrl={getImageUrl}
        />
      )}

      {!isLoading && characters.length > 0 && !timelineBounds && (
        <p className={styles.hint}>
          Колесо мыши или щипок двумя пальцами — масштаб, перетаскивание фона — панорама
          {isEditor
            ? ', перетаскивание персонажа — перемещение, правая кнопка мыши (или долгое нажатие) на персонаже — создать связь'
            : ''}.
        </p>
      )}

      {!isLoading && timelineBounds && timelineYear !== null && (
        <TimelineControl
          bounds={timelineBounds}
          value={timelineYear}
          marks={timelineMarks}
          onChange={setTimelineYear}
        />
      )}

      {selectedCharacter && (
        <CharacterPanel
          character={selectedCharacter}
          imageUrl={selectedCharacter.imagePath ? getImageUrl(selectedCharacter.imagePath) : null}
          isEditor={isEditor}
          onClose={() => selectCharacter(null)}
          onSave={patch => handleSaveCharacter(selectedCharacter.id, patch).catch(error => {
            setActionError(error instanceof Error ? error.message : 'Не удалось сохранить.')
            throw error
          })}
          onUploadImage={file => handleUploadCharacterImage(selectedCharacter, file)}
          onDelete={() => handleDeleteCharacter(selectedCharacter)}
          getGalleryImageUrl={getImageUrl}
          onAddGalleryItem={file => handleAddGalleryItem(selectedCharacter, file)}
          onUpdateGalleryItem={(itemId, patch) => handleUpdateGalleryItem(selectedCharacter, itemId, patch)}
          onRemoveGalleryItem={itemId => handleRemoveGalleryItem(selectedCharacter, itemId)}
        />
      )}

      {selectedRelationship && relationshipFrom && relationshipTo && (
        <RelationshipPanel
          relationship={selectedRelationship}
          from={relationshipFrom}
          to={relationshipTo}
          isEditor={isEditor}
          onClose={() => selectRelationship(null)}
          onSave={patch => handleSaveRelationship(selectedRelationship.id, patch)}
          onDelete={() => handleDeleteRelationship(selectedRelationship.id)}
          onSelectCharacter={selectCharacter}
        />
      )}

      {showAddCharacter && (
        <AddCharacterModal
          onClose={() => setShowAddCharacter(false)}
          onCreate={handleCreateCharacter}
        />
      )}

      {relationshipDraft && (
        <AddRelationshipModal
          characters={characters}
          initialFromId={relationshipDraft.fromId}
          initialToId={relationshipDraft.toId}
          onClose={() => setRelationshipDraft(null)}
          onCreate={handleCreateRelationship}
        />
      )}

      {showExport && <ExportModal text={exportText} onClose={() => setShowExport(false)} />}

      {showRoster && (
        <CharacterRosterModal
          characters={characters}
          timelineYear={timelineYear}
          onSelect={selectCharacter}
          onClose={() => setShowRoster(false)}
        />
      )}
    </div>
  )
}
