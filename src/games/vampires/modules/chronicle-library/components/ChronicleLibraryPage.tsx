'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { createClient } from '@/games/vampires/lib/supabase'
import MarkdownRenderer from '@/games/vampires/modules/reference/components/MarkdownRenderer'
import { collectHeadings, getSearchTerms } from '@/games/vampires/modules/reference/utils/markdown'
import type { ChronicleDocument, ChronicleSearchHit, LibraryChronicle } from '../types'
import { loadPersonalChronicleDocuments } from '../api/personal-chronicle-api'
import {
  buildChronicleDocuments,
  isLibraryChronicle,
  parseChronicleUpload,
  searchChronicleDocuments,
} from '../utils/chronicle-markdown'
import ChronicleLibrarySidebar from './ChronicleLibrarySidebar'
import PersonalChroniclePanel from './PersonalChroniclePanel'

const MAX_UPLOAD_BYTES = 1_000_000

function makeChronicleUrl(chronicleId: string, sourceName = '', hash = '') {
  const params = new URLSearchParams({ chronicle: chronicleId })
  if (sourceName) params.set('document', sourceName)
  return `/library/chronicles?${params.toString()}${hash ? `#${hash}` : ''}`
}

export default function ChronicleLibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, tf } = useLang()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [chronicles, setChronicles] = useState<LibraryChronicle[]>([])
  const [documents, setDocuments] = useState<ChronicleDocument[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [pageError, setPageError] = useState('')
  const [joinTitle, setJoinTitle] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [query, setQuery] = useState('')
  const [uploadChronicleId, setUploadChronicleId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const requestedChronicleId = searchParams.get('chronicle') || ''
  const requestedSourceName = searchParams.get('document') || ''
  const activeChronicle = chronicles.find(item => item.id === requestedChronicleId)
    || chronicles[0]
    || null
  const activeDocument = documents.find(item => item.sourceName === requestedSourceName)
    || documents[0]
    || null

  const loadMemberships = useCallback(async () => {
    const { data, error } = await createClient().rpc('list_my_library_chronicles')
    if (error) throw error
    const available = Array.isArray(data) ? data.filter(isLibraryChronicle) : []
    setChronicles(available)
    return available
  }, [])

  useEffect(() => {
    let cancelled = false
    const client = createClient()
    client.auth.getUser()
      .then(async ({ data, error }) => {
        if (error || !data.user) {
          if (!cancelled) setHasSession(false)
          return
        }
        if (cancelled) return
        setHasSession(true)
        const [memberships, masterResult] = await Promise.all([
          client.rpc('list_my_library_chronicles'),
          client.rpc('is_any_chronicle_master'),
        ])
        if (cancelled) return
        if (memberships.error) throw memberships.error
        const available = Array.isArray(memberships.data)
          ? memberships.data.filter(isLibraryChronicle)
          : []
        setChronicles(available)
        setIsMaster(!masterResult.error && masterResult.data === true)
      })
      .catch(error => {
        console.error('chronicle library auth:', error)
        if (!cancelled) {
          setHasSession(false)
          setPageError(t('Не удалось загрузить хроники. Попробуйте ещё раз.'))
        }
      })
    return () => { cancelled = true }
  }, [t])

  useEffect(() => {
    if (!activeChronicle) return
    if (requestedChronicleId === activeChronicle.id) return
    router.replace(makeChronicleUrl(activeChronicle.id), { scroll: false })
  }, [activeChronicle, requestedChronicleId, router])

  useEffect(() => {
    if (!activeChronicle) {
      setDocuments([])
      return
    }
    let cancelled = false
    setLoadingDocuments(true)
    setPageError('')
    setDocuments([])
    void (async () => {
      try {
        const [officialResult, personalDocuments] = await Promise.all([
          createClient()
            .from('library_chronicle_chunks')
            .select('source_name, document_title, section_title, chunk_index, content')
            .eq('chronicle_id', activeChronicle.id)
            .order('source_name', { ascending: true })
            .order('chunk_index', { ascending: true }),
          loadPersonalChronicleDocuments(activeChronicle.id),
        ])
        if (officialResult.error) throw officialResult.error
        if (cancelled) return
        setDocuments([
          ...buildChronicleDocuments(Array.isArray(officialResult.data) ? officialResult.data : []),
          ...personalDocuments,
        ])
      } catch (error) {
        console.error('library_chronicle_chunks:', error)
        if (!cancelled) setPageError(t('Не удалось загрузить текст хроники.'))
      } finally {
        if (!cancelled) setLoadingDocuments(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeChronicle, reloadKey, t])

  useEffect(() => {
    if (!activeChronicle || !activeDocument) return
    if (requestedSourceName === activeDocument.sourceName) return
    router.replace(makeChronicleUrl(activeChronicle.id, activeDocument.sourceName), { scroll: false })
  }, [activeChronicle, activeDocument, requestedSourceName, router])

  useEffect(() => {
    if (chronicles.length === 0) {
      setUploadChronicleId('')
      return
    }
    if (!chronicles.some(item => item.id === uploadChronicleId)) {
      setUploadChronicleId(activeChronicle?.id || chronicles[0].id)
    }
  }, [activeChronicle?.id, chronicles, uploadChronicleId])

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash || loadingDocuments) return
    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [activeDocument?.sourceName, loadingDocuments])

  const searchHits = useMemo(
    () => searchChronicleDocuments(documents, query),
    [documents, query],
  )
  const searchTerms = useMemo(() => getSearchTerms(query), [query])
  const headings = useMemo(
    () => collectHeadings(activeDocument?.markdown || ''),
    [activeDocument?.markdown],
  )

  const selectChronicle = useCallback((chronicleId: string) => {
    setQuery('')
    const selected = chronicles.find(item => item.id === chronicleId)
    if (selected) {
      setChronicles(previous => [selected, ...previous.filter(item => item.id !== chronicleId)])
      void (async () => {
        const { data, error } = await createClient().rpc('open_library_chronicle', {
          p_title: selected.title,
        })
        if (error) console.error('refresh open_library_chronicle:', error)
        const opened = Array.isArray(data) ? data.find(isLibraryChronicle) : null
        if (opened) {
          setChronicles(previous => [opened, ...previous.filter(item => item.id !== opened.id)])
        }
      })()
    }
    router.push(makeChronicleUrl(chronicleId), { scroll: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [chronicles, router])

  const selectDocument = useCallback((sourceName: string, hash = '') => {
    if (!activeChronicle) return
    router.push(makeChronicleUrl(activeChronicle.id, sourceName, hash), { scroll: false })
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [activeChronicle, router])

  const openSearchHit = (hit: ChronicleSearchHit) => {
    selectDocument(hit.sourceName, hit.slug)
  }

  const downloadActiveDocument = () => {
    if (!activeDocument || activeDocument.scope !== 'personal') return
    const blob = new Blob([activeDocument.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = activeDocument.downloadName || `${activeDocument.title}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  const joinChronicle = async () => {
    const title = joinTitle.trim()
    if (!title || joining) return
    setJoining(true)
    setJoinError('')
    try {
      const { data, error } = await createClient().rpc('open_library_chronicle', { p_title: title })
      if (error) throw error
      const opened = Array.isArray(data) ? data.find(isLibraryChronicle) : null
      if (!opened) {
        setJoinError(t('Хроника с таким названием не найдена. Проверь написание.'))
        return
      }
      await loadMemberships()
      setJoinTitle('')
      selectChronicle(opened.id)
    } catch (error) {
      console.error('open_library_chronicle:', error)
      setJoinError(t('Не удалось открыть хронику. Проверь вход в аккаунт и попробуй ещё раз.'))
    } finally {
      setJoining(false)
    }
  }

  const uploadDocument = async () => {
    if (!uploadFile || !uploadChronicleId || uploading) return
    setUploadMessage('')
    if (uploadFile.size > MAX_UPLOAD_BYTES) {
      setUploadMessage(t('Файл слишком большой. Максимум — 1 МБ текста.'))
      return
    }
    if (!/\.(?:md|markdown|txt)$/i.test(uploadFile.name)) {
      setUploadMessage(t('Можно загрузить только Markdown или TXT.'))
      return
    }

    setUploading(true)
    try {
      const parsed = parseChronicleUpload(await uploadFile.text(), uploadFile.name)
      const { error } = await createClient().rpc('replace_library_chronicle_document', {
        p_chronicle_id: uploadChronicleId,
        p_source_name: uploadFile.name,
        p_document_title: parsed.documentTitle,
        p_chunks: parsed.chunks,
      })
      if (error) throw error
      setUploadMessage(tf('Файл «{name}» загружен. Его видят все участники хроники.', { name: uploadFile.name }))
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setReloadKey(value => value + 1)
      selectChronicle(uploadChronicleId)
    } catch (error) {
      console.error('replace_library_chronicle_document:', error)
      setUploadMessage(error instanceof Error
        ? error.message
        : t('Не удалось загрузить файл хроники.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="chronicle-shell">
      <section className="chronicle-topbar">
        <div>
          <p className="chronicle-kicker">VTM PRIVATE ARCHIVE</p>
          <h1>{t('Хроника')}</h1>
        </div>
        <nav aria-label={t('Навигация хроники')}>
          <Link href="/">{t('Главная')}</Link>
          <Link href="/reference">{t('Справочник')}</Link>
          <Link href="/library/chat">{t('Чат')}</Link>
        </nav>
      </section>

      {hasSession === false ? (
        <section className="chronicle-locked">
          <h2>{t('Закрытый архив')}</h2>
          <p>{t('Войдите в аккаунт, чтобы увидеть доступные вам хроники.')}</p>
          <Link href="/">{t('В салон')}</Link>
        </section>
      ) : null}

      {hasSession ? (
        <>
          <section className="chronicle-access-panel">
            <div>
              <span>{t('Закрытые истории')}</span>
              <strong>{t('Тексты открываются только участникам выбранной хроники.')}</strong>
            </div>
            <form onSubmit={event => { event.preventDefault(); void joinChronicle() }}>
              <label>
                <span>{t('Подключиться по точному названию')}</span>
                <input
                  value={joinTitle}
                  onChange={event => setJoinTitle(event.target.value)}
                  placeholder={t('Название хроники')}
                  maxLength={160}
                />
              </label>
              <button type="submit" disabled={joining || !joinTitle.trim()}>
                {joining ? t('Открываю...') : t('Подключиться')}
              </button>
            </form>
            {joinError ? <p className="chronicle-error">{joinError}</p> : null}
          </section>

          {isMaster ? (
            <section className="chronicle-upload-panel">
              <div>
                <span>{t('Загрузка мастера')}</span>
                <strong>{t('Добавьте Markdown или TXT в хронику, к которой вы уже подключены.')}</strong>
                <small>{t('Файл с тем же именем заменит прежнюю версию целиком.')}</small>
              </div>
              <label>
                <span>{t('Куда загрузить')}</span>
                <select value={uploadChronicleId} onChange={event => setUploadChronicleId(event.target.value)}>
                  {chronicles.map(chronicle => (
                    <option value={chronicle.id} key={chronicle.id}>{chronicle.title}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('Файл хроники')}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  onChange={event => setUploadFile(event.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                onClick={() => void uploadDocument()}
                disabled={!uploadFile || !uploadChronicleId || uploading}
              >
                {uploading ? t('Загружаю...') : t('Загрузить в хронику')}
              </button>
              {uploadMessage ? <p className="chronicle-upload-message">{uploadMessage}</p> : null}
            </section>
          ) : null}

          {chronicles.length > 0 ? (
            <PersonalChroniclePanel
              chronicles={chronicles}
              activeChronicleId={activeChronicle?.id || chronicles[0].id}
              onCompleted={chronicleId => {
                if (chronicleId !== activeChronicle?.id) selectChronicle(chronicleId)
                setReloadKey(value => value + 1)
              }}
            />
          ) : null}

          {chronicles.length === 0 ? (
            <section className="chronicle-empty">
              <h2>{t('Подключённых хроник пока нет')}</h2>
              <p>{t('Введите точное название хроники выше. После первого входа она останется в вашем списке.')}</p>
            </section>
          ) : (
            <>
              <section className="chronicle-doc-header">
                <div>
                  <p>{t('Открытая хроника')}</p>
                  <h2>{activeChronicle?.title}</h2>
                </div>
                <div className="chronicle-doc-current">
                  <span>{activeDocument?.scope === 'personal' ? t('Личный документ') : t('Официальная хроника')}</span>
                  <strong>{activeDocument?.title || t('Документы ещё не загружены')}</strong>
                  {activeDocument?.scope === 'personal' ? (
                    <button type="button" onClick={downloadActiveDocument}>{t('Скачать .md')}</button>
                  ) : null}
                </div>
              </section>

              <section className="chronicle-searchbar" aria-label={t('Поиск по хронике')}>
                <label>
                  <span>{t('Поиск по всем документам хроники')}</span>
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t('Например: Бриджет Кит Геенна')}
                  />
                </label>
                <div>
                  {searchTerms.length > 0 ? (
                    <>
                      <strong>{tf('Найдено разделов: {count}', { count: searchHits.length })}</strong>
                      <button type="button" onClick={() => setQuery('')}>{t('Сбросить')}</button>
                    </>
                  ) : <span>{t('Поиск идёт по официальной хронике и вашим личным документам.')}</span>}
                </div>
              </section>

              {searchTerms.length > 0 && searchHits.length > 0 ? (
                <section className="chronicle-results" aria-label={t('Результаты поиска')}>
                  {searchHits.slice(0, 24).map(hit => (
                    <button
                      type="button"
                      key={`${hit.sourceName}-${hit.chunkIndex}`}
                      onClick={() => openSearchHit(hit)}
                    >
                      <span>{hit.documentTitle}</span>
                      <strong>{hit.sectionTitle}</strong>
                      <small>{hit.snippet}</small>
                    </button>
                  ))}
                </section>
              ) : null}

              {searchTerms.length > 0 && searchHits.length === 0 && !loadingDocuments ? (
                <section className="chronicle-empty compact">
                  <p>{tf('По запросу **{query}** ничего не найдено. Попробуйте другое слово или более общий термин.', { query: query.trim() })}</p>
                </section>
              ) : null}

              {pageError ? <p className="chronicle-error">{pageError}</p> : null}
              <section className="chronicle-layout">
                <ChronicleLibrarySidebar
                  chronicles={chronicles}
                  activeChronicle={activeChronicle}
                  documents={documents}
                  activeDocument={activeDocument}
                  headings={headings}
                  onSelectChronicle={selectChronicle}
                  onSelectDocument={selectDocument}
                  labels={{
                    chronicles: t('Мои хроники'),
                    shortChronicle: t('Краткая хроника'),
                    fullText: t('Полный текст'),
                    headings: t('На этой странице'),
                    noShortChronicle: t('Краткая хроника пока пуста'),
                    noFullText: t('Полные тексты пока не загружены'),
                  }}
                />
                <MarkdownRenderer
                  markdown={activeDocument?.markdown || `# ${loadingDocuments ? t('Загружаю хронику...') : t('Документы ещё не загружены')}`}
                  searchTerms={searchTerms}
                />
              </section>
            </>
          )}
        </>
      ) : null}

      {hasSession === null ? <p className="chronicle-loading">{t('Проверяю доступ...')}</p> : null}

      <style jsx global>{`
        html, body { margin: 0; background: #080506; color: #f4eadf; scroll-behavior: smooth; }
        body { overflow-x: hidden; }
      `}</style>

      <style jsx>{`
        .chronicle-shell {
          min-height: 100vh;
          min-height: 100dvh;
          overflow-x: hidden;
          padding: 18px clamp(14px, 2.4vw, 34px) 60px;
          font-family: "Courier New", Courier, monospace;
          background:
            radial-gradient(circle at 18% 0%, rgba(125, 19, 25, 0.32), transparent 34rem),
            linear-gradient(180deg, rgba(45, 4, 8, 0.95), rgba(8, 5, 6, 0.98) 28rem),
            #080506;
        }
        .chronicle-topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 1px solid #2d2d2d; padding-bottom: 12px; margin-bottom: 18px; }
        .chronicle-kicker { margin: 0 0 5px; color: #ff3131; letter-spacing: .16em; text-transform: uppercase; font-size: 12px; }
        .chronicle-topbar h1 { margin: 0; color: #fff7ed; font-size: clamp(34px, 5vw, 58px); }
        .chronicle-topbar nav { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
        .chronicle-topbar a, .chronicle-access-panel button, .chronicle-upload-panel button, .chronicle-searchbar button, .chronicle-locked a, .chronicle-doc-current button {
          border: 1px solid #773030; border-radius: 6px; color: #f5f5f5; text-decoration: none; padding: 10px 14px; background: #141414; font: inherit; font-size: 14px; cursor: pointer;
        }
        .chronicle-topbar a:hover, .chronicle-access-panel button:hover:not(:disabled), .chronicle-upload-panel button:hover:not(:disabled), .chronicle-searchbar button:hover, .chronicle-locked a:hover, .chronicle-doc-current button:hover { border-color: #ff3131; background: #221111; }
        button:disabled { opacity: .45; cursor: default; }
        .chronicle-access-panel, .chronicle-upload-panel, .chronicle-doc-header, .chronicle-locked, .chronicle-empty {
          display: grid; gap: 12px; margin-bottom: 16px; padding: 14px 16px; border: 1px solid rgba(151, 44, 44, .34); border-radius: 8px; background: rgba(12, 8, 9, .76);
        }
        .chronicle-access-panel { grid-template-columns: minmax(220px, .8fr) minmax(320px, 1.2fr); align-items: end; }
        .chronicle-access-panel > div, .chronicle-upload-panel > div { display: grid; gap: 5px; }
        .chronicle-access-panel span, .chronicle-upload-panel span, .chronicle-doc-header p, .chronicle-searchbar span { color: #d6aa65; font-size: 13px; }
        .chronicle-access-panel strong, .chronicle-upload-panel strong { color: #e8dccc; line-height: 1.45; }
        .chronicle-access-panel form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
        .chronicle-access-panel label, .chronicle-upload-panel label, .chronicle-searchbar label { display: grid; gap: 7px; min-width: 0; }
        .chronicle-access-panel input, .chronicle-upload-panel select, .chronicle-upload-panel input, .chronicle-searchbar input {
          box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; border: 1px solid rgba(151, 44, 44, .72); border-radius: 7px; background: #0d0a0a; color: #fff8ef; padding: 0 12px; font: inherit;
        }
        .chronicle-upload-panel { grid-template-columns: minmax(260px, 1fr) minmax(190px, .6fr) minmax(240px, .8fr) auto; align-items: end; }
        .chronicle-upload-panel small { color: #a99b90; line-height: 1.4; }
        .chronicle-upload-panel input[type="file"] { padding: 9px; }
        .chronicle-error, .chronicle-upload-message { grid-column: 1 / -1; margin: 0; color: #ffaaaa; line-height: 1.5; }
        .chronicle-upload-message { color: #f2d7ad; }
        .chronicle-doc-header { grid-template-columns: 1fr auto; align-items: end; }
        .chronicle-doc-header p { margin: 0 0 5px; }
        .chronicle-doc-header h2 { margin: 0; color: #fff7ed; font-size: clamp(24px, 3vw, 34px); }
        .chronicle-doc-current { display: grid; justify-items: end; gap: 5px; text-align: right; }
        .chronicle-doc-current span { color: #d6aa65; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
        .chronicle-doc-current strong { color: #cdbfb0; }
        .chronicle-doc-current button { padding: 7px 10px; }
        .chronicle-searchbar {
          position: sticky; top: 0; z-index: 20; display: grid; grid-template-columns: minmax(0, 680px) minmax(220px, 1fr); gap: 12px; align-items: end; margin: 0 0 20px; padding: 12px; border: 1px solid rgba(151, 44, 44, .42); border-radius: 8px; background: rgba(10, 7, 8, .96); box-shadow: 0 16px 44px rgba(0, 0, 0, .34); backdrop-filter: blur(12px);
        }
        .chronicle-searchbar > div { min-height: 44px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }
        .chronicle-searchbar strong { color: #ffd89a; }
        .chronicle-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin: 0 0 20px; }
        .chronicle-results button { display: grid; gap: 5px; border: 1px solid rgba(151, 44, 44, .34); border-radius: 8px; background: rgba(15, 10, 11, .74); color: #eadfd3; padding: 12px; text-align: left; font: inherit; cursor: pointer; }
        .chronicle-results button:hover { border-color: #c53030; background: rgba(54, 12, 15, .72); }
        .chronicle-results span { color: #b8a89a; font-size: 12px; }
        .chronicle-results strong { color: #ffd89a; }
        .chronicle-results small { color: #cdbfb0; line-height: 1.45; }
        .chronicle-layout { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 28px; align-items: start; min-width: 0; }
        .chronicle-empty h2, .chronicle-locked h2 { margin: 0; color: #fff7ed; }
        .chronicle-empty p, .chronicle-locked p { margin: 0; color: #cdbfb0; line-height: 1.55; }
        .chronicle-empty.compact { padding: 12px; }
        .chronicle-locked { max-width: 720px; }
        .chronicle-locked a { width: fit-content; }
        .chronicle-loading { color: #d6aa65; }
        :global(.chronicle-sidebar) { position: sticky; top: 92px; max-height: calc(100vh - 112px); overflow: auto; border: 1px solid rgba(151, 44, 44, .38); border-radius: 8px; background: rgba(13, 10, 10, .84); }
        :global(.chronicle-sidebar-inner) { display: grid; gap: 18px; padding: 14px; }
        :global(.chronicle-sidebar-section) { display: grid; gap: 10px; }
        :global(.chronicle-sidebar-section > span) { color: #d6aa65; font-size: 13px; text-transform: uppercase; letter-spacing: .14em; }
        :global(.chronicle-doc-nav), :global(.chronicle-heading-nav) { display: grid; gap: 4px; }
        :global(.chronicle-doc-nav > small) { color: #9f9287; line-height: 1.4; }
        :global(.chronicle-doc-link) { display: grid; gap: 2px; width: 100%; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #cdbfb0; padding: 8px 9px; text-align: left; font: inherit; cursor: pointer; }
        :global(.chronicle-doc-link strong) { color: #f2d7ad; font-size: 13px; }
        :global(.chronicle-doc-link small) { color: #9f9287; font-size: 11px; }
        :global(.chronicle-doc-link:hover), :global(.chronicle-doc-link.active) { border-color: rgba(151, 44, 44, .42); background: rgba(140, 28, 34, .22); }
        :global(.chronicle-heading-nav a) { color: #cdbfb0; text-decoration: none; border-radius: 5px; padding: 7px 8px; line-height: 1.35; font-size: 13px; }
        :global(.chronicle-heading-nav a.level-3) { padding-left: 20px; color: #a99b90; font-size: 12px; }
        :global(.chronicle-heading-nav a:hover) { background: rgba(140, 28, 34, .28); color: #ffd89a; }
        :global(.reference-markdown) { width: 100%; min-width: 0; color: #eadfd3; font-family: Georgia, "Times New Roman", serif; font-size: 18px; line-height: 1.78; overflow-wrap: anywhere; }
        :global(.reference-markdown h1), :global(.reference-markdown h2), :global(.reference-markdown h3), :global(.reference-markdown h4) { font-family: "Courier New", Courier, monospace; color: #fff7ed; line-height: 1.2; scroll-margin-top: 118px; }
        :global(.reference-markdown h1) { margin: 0 0 28px; font-size: clamp(34px, 5vw, 56px); }
        :global(.reference-markdown h2) { margin: 54px 0 18px; padding-top: 24px; border-top: 1px solid rgba(151, 44, 44, .42); font-size: clamp(28px, 4vw, 42px); }
        :global(.reference-markdown h3) { margin: 34px 0 12px; color: #f3c77f; font-size: clamp(22px, 3vw, 30px); }
        :global(.reference-markdown h4) { margin: 26px 0 8px; color: #f0d5ac; font-size: 20px; }
        :global(.reference-markdown p), :global(.reference-markdown ul), :global(.reference-markdown ol), :global(.reference-markdown blockquote) { max-width: 1180px; margin: 0 0 18px; }
        :global(.reference-markdown strong) { color: #fff1dc; }
        :global(.reference-markdown a) { color: #ffb36b; text-underline-offset: 4px; }
        :global(.reference-markdown ul), :global(.reference-markdown ol) { padding-left: 1.35em; }
        :global(.reference-markdown li) { margin: 8px 0; }
        :global(.reference-callout) { border-left: 3px solid #9f2d2d; background: rgba(82, 12, 18, .22); padding: 14px 18px; color: #dccfc1; border-radius: 0 8px 8px 0; }
        :global(.reference-highlight-fragment) { display: contents; }
        :global(.reference-search-hit) { border-radius: 4px; background: rgba(255, 49, 49, .28); color: #fff6ee; padding: 0 3px; }
        :global(.reference-table-wrap) { width: 100%; overflow-x: auto; margin: 24px 0; }
        :global(.reference-markdown table) { width: 100%; border-collapse: collapse; font-size: 16px; }
        :global(.reference-markdown th), :global(.reference-markdown td) { border: 1px solid rgba(151, 44, 44, .34); padding: 10px; text-align: left; }
        :global(.reference-markdown th) { background: rgba(87, 18, 24, .36); color: #ffd89a; }
        @media (max-width: 980px) {
          .chronicle-upload-panel { grid-template-columns: 1fr 1fr; }
          .chronicle-upload-panel > div { grid-column: 1 / -1; }
          .chronicle-layout { grid-template-columns: 1fr; }
          :global(.chronicle-sidebar) { position: static; max-height: none; }
        }
        @media (max-width: 720px) {
          .chronicle-shell { padding: 12px 12px 44px; }
          .chronicle-topbar, .chronicle-doc-header { align-items: flex-start; flex-direction: column; }
          .chronicle-topbar { display: flex; }
          .chronicle-topbar nav { justify-content: flex-start; }
          .chronicle-access-panel, .chronicle-upload-panel, .chronicle-searchbar { grid-template-columns: 1fr; }
          .chronicle-access-panel form { grid-template-columns: 1fr; }
          .chronicle-doc-header { display: flex; }
          .chronicle-doc-current { justify-items: start; text-align: left; }
          .chronicle-searchbar { position: static; }
        }
      `}</style>
    </main>
  )
}
