'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { translateCharacterToEnglish, translateRelationshipToEnglish } from '../api/translateApi'
import { CHARACTERS_MAP_OWNER_AUTH_USER_ID, createDefaultCharacterSheet } from '../constants'
import { exportCharactersMapToText } from '../export'
import {
  isCharacterTranslationStale,
  isRelationshipTranslationStale,
  localizeCharacter,
  localizeRelationship,
  t,
  type MapLanguage,
} from '../i18n'
import { createCharactersMapClient } from '../supabase'
import { collectTimelineMarks, computeTimelineBounds, yearMoment, type TimelineMoment } from '../timeline'
import type {
  CharacterSheet,
  EventRelationshipDraft,
  GalleryItem,
  MapCharacter,
  MapRelationship,
  RelationshipEvent,
  RelationshipKind,
} from '../types'
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
const LANGUAGE_STORAGE_KEY = 'characters-map-language'

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
  const [timelineMoment, setTimelineMoment] = useState<TimelineMoment | null>(null)
  const [language, setLanguage] = useState<MapLanguage>('ru')
  const [translationStatus, setTranslationStatus] = useState<{ done: number; total: number } | null>(null)

  const isOwner = authUserId === CHARACTERS_MAP_OWNER_AUTH_USER_ID
  const isEditor = isOwner && editModeOn
  const s = t(language)

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

  // A `?lang=en` link (shared with, say, a non-Russian-reading viewer) wins on
  // first load and is also remembered, so a reload without the query param
  // stays in English; otherwise fall back to whatever was last chosen.
  useEffect(() => {
    const fromUrl = searchParams.get('lang')
    if (fromUrl === 'en' || fromUrl === 'ru') {
      setLanguage(fromUrl)
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, fromUrl)
      return
    }
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'en') setLanguage('en')
    // Only ever read once on mount — afterward the toggle button is the only writer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setLoadError(t('ru').loading.loadFailed)
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

  const updateUrl = useCallback((characterId: string | null, relationshipId: string | null, lang: MapLanguage) => {
    const params = new URLSearchParams()
    if (characterId) params.set('char', characterId)
    else if (relationshipId) params.set('rel', relationshipId)
    if (lang === 'en') params.set('lang', 'en')
    const query = params.toString()
    router.replace(query ? `/characters_map?${query}` : '/characters_map', { scroll: false })
  }, [router])

  const selectCharacter = useCallback((id: string | null) => {
    setSelectedCharacterId(id)
    if (id) setSelectedRelationshipId(null)
    updateUrl(id, null, language)
  }, [updateUrl, language])

  const selectRelationship = useCallback((id: string | null) => {
    setSelectedRelationshipId(id)
    if (id) setSelectedCharacterId(null)
    updateUrl(null, id, language)
  }, [updateUrl, language])

  const changeLanguage = useCallback((next: MapLanguage) => {
    setLanguage(next)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    updateUrl(selectedCharacterId, selectedRelationshipId, next)
  }, [updateUrl, selectedCharacterId, selectedRelationshipId])

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

  /**
   * Saves a character sheet *and* the relationship lines its events carry (the
   * event↔relationship link). Relationship work happens first, so the sheet we
   * finally write already knows the ids of the lines its events produced:
   *
   *  1. delete the lines the owner removed while editing,
   *  2. create/patch each draft, stamping its appearance event with the source
   *     event's date — that date is what makes the line show up on the map at
   *     the right moment and stay invisible before it,
   *  3. write the sheet with `relationshipIds` refreshed per event.
   */
  const handleSaveCharacter = useCallback(async (character: MapCharacter, patch: {
    name: string
    description: string
    sheet: CharacterSheet
    eventRelationships: EventRelationshipDraft[]
    removedRelationshipIds: string[]
  }) => {
    const removedIds = new Set(patch.removedRelationshipIds)
    for (const relationshipId of patch.removedRelationshipIds) {
      await deleteRelationship(client, relationshipId)
    }

    const touched: MapRelationship[] = []
    const createdIds = new Set<string>()
    const idsByEvent = new Map<string, string[]>()

    for (const draft of patch.eventRelationships) {
      const sourceEvent = patch.sheet.events.find(event => event.id === draft.eventId)
      if (!sourceEvent || !draft.targetCharacterId || !draft.label.trim()) continue
      const fromCharacterId = draft.direction === 'in' ? draft.targetCharacterId : character.id
      const toCharacterId = draft.direction === 'in' ? character.id : draft.targetCharacterId
      const kind: RelationshipKind = draft.direction === 'mutual' ? 'mutual' : 'directed'
      const existing = draft.id ? relationships.find(item => item.id === draft.id) ?? null : null

      const appearance: RelationshipEvent = {
        id: existing?.events.find(event => event.sourceEventId === draft.eventId)?.id ?? crypto.randomUUID(),
        year: sourceEvent.year,
        month: sourceEvent.month,
        day: sourceEvent.day,
        dateLabel: '',
        title: sourceEvent.title || draft.label,
        appears: true,
        sourceCharacterId: character.id,
        sourceEventId: draft.eventId,
      }

      let saved: MapRelationship
      if (existing) {
        saved = await updateRelationship(client, existing.id, {
          fromCharacterId,
          toCharacterId,
          kind,
          label: draft.label,
          description: draft.description,
          color: draft.color,
          events: [...existing.events.filter(event => event.sourceEventId !== draft.eventId), appearance],
        })
      } else {
        const created = await createRelationship(client, {
          fromCharacterId,
          toCharacterId,
          kind,
          label: draft.label,
          description: draft.description,
          color: draft.color,
        }, relationships.length + touched.length)
        saved = await updateRelationship(client, created.id, { events: [appearance] })
        createdIds.add(saved.id)
      }
      touched.push(saved)
      idsByEvent.set(draft.eventId, [...(idsByEvent.get(draft.eventId) ?? []), saved.id])
    }

    const sheet: CharacterSheet = {
      ...patch.sheet,
      events: patch.sheet.events.map(event => {
        const ids = idsByEvent.get(event.id)
        if (ids && ids.length > 0) return { ...event, relationshipIds: ids }
        return event.relationshipIds ? { ...event, relationshipIds: undefined } : event
      }),
    }

    const updated = await updateCharacter(client, character.id, {
      name: patch.name,
      description: patch.description,
      sheet,
    })
    setCharacters(previous => previous.map(item => (item.id === character.id ? updated : item)))
    if (removedIds.size > 0 || touched.length > 0) {
      const byId = new Map(touched.map(item => [item.id, item]))
      setRelationships(previous => [
        ...previous.filter(item => !removedIds.has(item.id)).map(item => byId.get(item.id) ?? item),
        ...touched.filter(item => createdIds.has(item.id)),
      ])
    }
  }, [client, relationships])

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

  // Owner-triggered, cached translation: runs only while the owner is both
  // authenticated and in edit mode, viewing in English — everyone else only
  // ever reads whatever is already cached in `translationEn`. Sequential
  // (never parallel) so it doesn't hammer the translation API, with a
  // re-entrancy guard since both the effect below and a post-save nudge can
  // ask for a scan at close to the same time.
  const charactersRef = useRef(characters)
  const relationshipsRef = useRef(relationships)
  useEffect(() => { charactersRef.current = characters }, [characters])
  useEffect(() => { relationshipsRef.current = relationships }, [relationships])
  const isScanningRef = useRef(false)
  const rerunRequestedRef = useRef(false)

  const runTranslationScan = useCallback(async () => {
    if (isScanningRef.current) {
      rerunRequestedRef.current = true
      return
    }
    isScanningRef.current = true
    try {
      const staleCharacters = charactersRef.current.filter(isCharacterTranslationStale)
      const staleRelationships = relationshipsRef.current.filter(isRelationshipTranslationStale)
      const total = staleCharacters.length + staleRelationships.length
      if (total === 0) return
      let done = 0
      setTranslationStatus({ done, total })
      for (const character of staleCharacters) {
        try {
          const translationEn = await translateCharacterToEnglish(client, character)
          const updated = await updateCharacter(client, character.id, { translationEn })
          setCharacters(previous => previous.map(item => (item.id === character.id ? updated : item)))
        } catch (error) {
          console.error('Character translation failed:', character.id, error)
        } finally {
          done += 1
          setTranslationStatus({ done, total })
        }
      }
      for (const relationship of staleRelationships) {
        try {
          const translationEn = await translateRelationshipToEnglish(client, relationship)
          const updated = await updateRelationship(client, relationship.id, { translationEn })
          setRelationships(previous => previous.map(item => (item.id === relationship.id ? updated : item)))
        } catch (error) {
          console.error('Relationship translation failed:', relationship.id, error)
        } finally {
          done += 1
          setTranslationStatus({ done, total })
        }
      }
    } finally {
      isScanningRef.current = false
      setTranslationStatus(null)
      if (rerunRequestedRef.current) {
        rerunRequestedRef.current = false
        runTranslationScan()
      }
    }
  }, [client])

  useEffect(() => {
    if (isEditor && language === 'en') runTranslationScan()
  }, [isEditor, language, runTranslationScan])

  const selectedCharacter = characters.find(character => character.id === selectedCharacterId) ?? null
  const selectedRelationship = relationships.find(relationship => relationship.id === selectedRelationshipId) ?? null
  const relationshipFrom = selectedRelationship
    ? characters.find(character => character.id === selectedRelationship.fromCharacterId)
    : null
  const relationshipTo = selectedRelationship
    ? characters.find(character => character.id === selectedRelationship.toCharacterId)
    : null

  const localizedCharacters = useMemo(
    () => characters.map(character => localizeCharacter(character, language)),
    [characters, language],
  )
  const localizedRelationships = useMemo(
    () => relationships.map(relationship => localizeRelationship(relationship, language)),
    [relationships, language],
  )
  const displayCharacter = selectedCharacter
    ? localizedCharacters.find(character => character.id === selectedCharacter.id) ?? selectedCharacter
    : null
  const displayRelationship = selectedRelationship
    ? localizedRelationships.find(relationship => relationship.id === selectedRelationship.id) ?? selectedRelationship
    : null
  const displayRelationshipFrom = relationshipFrom
    ? localizedCharacters.find(character => character.id === relationshipFrom.id) ?? relationshipFrom
    : null
  const displayRelationshipTo = relationshipTo
    ? localizedCharacters.find(character => character.id === relationshipTo.id) ?? relationshipTo
    : null

  const exportText = useMemo(
    () => exportCharactersMapToText(localizedCharacters, localizedRelationships, language),
    [localizedCharacters, localizedRelationships, language],
  )
  const timelineBounds = useMemo(() => computeTimelineBounds(characters, relationships), [characters, relationships])
  const timelineMarks = useMemo(
    () => collectTimelineMarks(localizedCharacters, localizedRelationships, language),
    [localizedCharacters, localizedRelationships, language],
  )

  // Once any timeline data exists, default the view to "present" (the end of
  // the latest known year) — everyone born so far, in their current state.
  // Only fires while the cursor hasn't been touched yet, so it never fights a
  // moment the user picked.
  useEffect(() => {
    if (timelineMoment === null && timelineBounds) setTimelineMoment(yearMoment(timelineBounds.max))
  }, [timelineBounds, timelineMoment])

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{s.topBar.title}</h1>
          <p className={styles.subtitle}>
            {isEditor ? s.topBar.subtitleEditor : !isAccountReady ? s.topBar.subtitleChecking : s.topBar.subtitleViewer}
          </p>
        </div>
        <div className={styles.actions}>
          {translationStatus && (
            <span className={styles.subtitle}>{s.topBar.translating(translationStatus.done, translationStatus.total)}</span>
          )}
          <button
            type="button"
            className={styles.addButton}
            onClick={() => changeLanguage(language === 'en' ? 'ru' : 'en')}
          >
            {s.topBar.languageButton}
          </button>
          {characters.length > 0 && (
            <button type="button" className={styles.addButton} onClick={() => setShowExport(true)}>
              {s.topBar.exportButton}
            </button>
          )}
          {isOwner && (
            <>
              <button type="button" className={styles.addButton} onClick={toggleEditMode}>
                {isEditor ? s.topBar.toViewModeButton : s.topBar.toEditModeButton}
              </button>
              {isEditor && (
                <>
                  <button type="button" className={styles.addButton} onClick={() => setShowAddCharacter(true)}>
                    {s.topBar.addCharacterButton}
                  </button>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => setRelationshipDraft({ fromId: selectedCharacterId, toId: null })}
                    disabled={characters.length < 2}
                  >
                    {s.topBar.addRelationshipButton}
                  </button>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => setShowRoster(true)}
                    disabled={characters.length === 0}
                  >
                    {s.topBar.rosterButton}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {actionError && <div className={styles.errorBanner}>{actionError}</div>}

      {isLoading && <div className={styles.centerMessage}>{s.loading.loadingMap}</div>}
      {!isLoading && loadError && <div className={styles.centerMessage}>{loadError}</div>}
      {!isLoading && !loadError && characters.length === 0 && (
        <div className={styles.centerMessage}>
          {isEditor ? s.loading.emptyEditor : s.loading.emptyViewer}
        </div>
      )}

      {!isLoading && !loadError && characters.length > 0 && (
        <MapCanvas
          characters={localizedCharacters}
          relationships={localizedRelationships}
          isEditor={isEditor}
          language={language}
          timelineMoment={timelineMoment}
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
          {s.hint.base}
          {isEditor ? s.hint.editorSuffix : ''}.
        </p>
      )}

      {!isLoading && timelineBounds && timelineMoment !== null && (
        <TimelineControl
          bounds={timelineBounds}
          value={timelineMoment}
          marks={timelineMarks}
          language={language}
          onChange={setTimelineMoment}
        />
      )}

      {selectedCharacter && displayCharacter && (
        <CharacterPanel
          character={selectedCharacter}
          displayCharacter={displayCharacter}
          characters={localizedCharacters}
          relationships={relationships}
          displayRelationships={localizedRelationships}
          language={language}
          imageUrl={selectedCharacter.imagePath ? getImageUrl(selectedCharacter.imagePath) : null}
          isEditor={isEditor}
          onClose={() => selectCharacter(null)}
          onSave={patch => handleSaveCharacter(selectedCharacter, patch).then(() => {
            runTranslationScan()
          }).catch(error => {
            setActionError(error instanceof Error ? error.message : s.characterPanel.errorSave)
            throw error
          })}
          onSelectRelationship={selectRelationship}
          onUploadImage={file => handleUploadCharacterImage(selectedCharacter, file)}
          onDelete={() => handleDeleteCharacter(selectedCharacter)}
          getGalleryImageUrl={getImageUrl}
          onAddGalleryItem={file => handleAddGalleryItem(selectedCharacter, file)}
          onUpdateGalleryItem={(itemId, patch) => handleUpdateGalleryItem(selectedCharacter, itemId, patch)}
          onRemoveGalleryItem={itemId => handleRemoveGalleryItem(selectedCharacter, itemId)}
        />
      )}

      {selectedRelationship && displayRelationship && relationshipFrom && relationshipTo && displayRelationshipFrom && displayRelationshipTo && (
        <RelationshipPanel
          relationship={selectedRelationship}
          displayRelationship={displayRelationship}
          language={language}
          from={displayRelationshipFrom}
          to={displayRelationshipTo}
          isEditor={isEditor}
          onClose={() => selectRelationship(null)}
          onSave={patch => handleSaveRelationship(selectedRelationship.id, patch).then(() => {
            runTranslationScan()
          })}
          onDelete={() => handleDeleteRelationship(selectedRelationship.id)}
          onSelectCharacter={selectCharacter}
        />
      )}

      {showAddCharacter && (
        <AddCharacterModal
          language={language}
          onClose={() => setShowAddCharacter(false)}
          onCreate={handleCreateCharacter}
        />
      )}

      {relationshipDraft && (
        <AddRelationshipModal
          language={language}
          characters={localizedCharacters}
          initialFromId={relationshipDraft.fromId}
          initialToId={relationshipDraft.toId}
          onClose={() => setRelationshipDraft(null)}
          onCreate={handleCreateRelationship}
        />
      )}

      {showExport && <ExportModal text={exportText} language={language} onClose={() => setShowExport(false)} />}

      {showRoster && (
        <CharacterRosterModal
          characters={localizedCharacters}
          language={language}
          timelineMoment={timelineMoment}
          onSelect={selectCharacter}
          onClose={() => setShowRoster(false)}
        />
      )}
    </div>
  )
}
