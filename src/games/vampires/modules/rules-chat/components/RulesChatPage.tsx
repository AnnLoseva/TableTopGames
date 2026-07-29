'use client'

// Чат-библиотекарь: структурные ответы из rules.json + цитаты из книг
// (book_pages) со страницами. Ничего не выдумывает.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { createClient } from '@/games/vampires/lib/supabase'
import {
  DEFAULT_RULES_EDITION,
  asText,
  buildBookSearchPlan,
  loadRules,
  normalizeToken,
  parseQuery,
  RULEBOOK_LIBRARY,
  RULES_EDITION_LABELS,
  RULES_EDITION_MODES,
  searchJournal,
  searchReference,
  type BookHit,
  type EntityMatch,
  type JournalHit,
  type ReferenceSearchHit,
  type RulesEditionMode,
} from '../engine'

type ChatMessage =
  | { role: 'user'; text: string }
  | {
      role: 'assistant'
      text: string
      journal?: JournalHit[]
      entities?: EntityMatch[]
      refHits?: Array<ReferenceSearchHit & { url: string }>
      hits?: BookHit[]
      chronicle?: ChronicleHit[]
    }

type LibraryChronicle = {
  id: string
  title: string
  joined_at: string
  last_opened_at: string
}

type ChronicleHit = {
  chronicle_id: string
  chronicle_title: string
  document_title: string
  section_title: string
  chunk_index: number
  rank: number
  snippet: string
}

const SUGGESTIONS = [
  'мой персонаж',
  'моя предыстория',
  'что было в дневнике',
  'клан Тореадор',
  'Величие',
  'голод последствия',
]

// ts_headline возвращает текст книги с <b>…</b> и часто режет фразу на
// полуслове. Экранируем всё, возвращаем только жирное выделение и сглаживаем
// рваные края многоточиями, чтобы выдержка читалась как цитата.
function renderSnippet(snippet: string) {
  const trimmed = snippet.replace(/\*\*|__/g, '').trim()
  const startsMidSentence = /^[a-zа-яё]/.test(trimmed)
  const endsMidSentence = !/[.!?…»)\]]$/.test(trimmed)
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBold = escaped
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
  return { __html: `${startsMidSentence ? '…' : ''}${withBold}${endsMidSentence ? '…' : ''}` }
}

function isBookHit(value: unknown): value is BookHit {
  if (!value || typeof value !== 'object') return false
  const hit = value as Partial<BookHit>
  return typeof hit.source === 'string'
    && typeof hit.title === 'string'
    && typeof hit.page === 'number'
    && typeof hit.rank === 'number'
    && typeof hit.snippet === 'string'
}

function isLibraryChronicle(value: unknown): value is LibraryChronicle {
  if (!value || typeof value !== 'object') return false
  const chronicle = value as Partial<LibraryChronicle>
  return typeof chronicle.id === 'string'
    && typeof chronicle.title === 'string'
    && typeof chronicle.joined_at === 'string'
    && typeof chronicle.last_opened_at === 'string'
}

function isChronicleHit(value: unknown): value is ChronicleHit {
  if (!value || typeof value !== 'object') return false
  const hit = value as Partial<ChronicleHit>
  return typeof hit.chronicle_id === 'string'
    && typeof hit.chronicle_title === 'string'
    && typeof hit.document_title === 'string'
    && typeof hit.section_title === 'string'
    && typeof hit.chunk_index === 'number'
    && typeof hit.rank === 'number'
    && typeof hit.snippet === 'string'
}

function Field({ label, value }: { label?: string; value: unknown }) {
  const text = asText(value)
  if (!text) return null
  return (
    <p>
      {label ? <strong>{label}: </strong> : null}
      {text}
    </p>
  )
}

function EntityCard({ entity }: { entity: EntityMatch }) {
  const { t } = useLang()
  if (entity.kind === 'clan') {
    return (
      <section className="rules-chat-card">
        <h3>{t('Клан')}: {entity.name}</h3>
        <Field value={entity.data.description} />
        <Field label={t('Дисциплины')} value={entity.data.disciplines} />
        <Field label={t('Проклятие')} value={entity.data.bane} />
        <Field label={t('Стиль игры')} value={entity.data.playstyle} />
        <Field label={t('Конфликт')} value={entity.data.conflict} />
      </section>
    )
  }
  if (entity.kind === 'discipline') {
    const levels = Object.entries(entity.data.powers || {})
    return (
      <section className="rules-chat-card">
        <h3>{t('Дисциплина')}: {entity.name}</h3>
        <Field value={entity.data.description} />
        <Field label={t('Система')} value={entity.data.system} />
        {levels.map(([level, powers]) => (
          <div key={level} className="rules-chat-card-level">
            <strong>{t('Уровень')} {level}</strong>
            {Object.entries(powers || {}).map(([powerName, power]) => {
              const description = asText(power.description)
              const pool = asText(power.pool)
              const cost = asText(power.cost)
              return (
                <div key={powerName} className="rules-chat-card-power">
                  <em>{powerName}</em>
                  {description ? <span> — {description}</span> : null}
                  {pool ? <small>{t('Пул')}: {pool}</small> : null}
                  {cost ? <small>{t('Цена')}: {cost}</small> : null}
                </div>
              )
            })}
          </div>
        ))}
      </section>
    )
  }
  if (entity.kind === 'power') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.name} <small>({entity.discipline}, {t('уровень')} {entity.level})</small></h3>
        <Field value={entity.data.description} />
        <Field label={t('Пул')} value={entity.data.pool} />
        <Field label={t('Цена')} value={entity.data.cost} />
        <Field label={t('Эффект')} value={entity.data.effect} />
      </section>
    )
  }
  if (entity.kind === 'merit') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.flaw ? t('Недостаток') : t('Преимущество')}: {entity.name}</h3>
        <Field value={entity.data['описание']} />
        {(entity.data['варианты'] || []).map(variant => (
          <Field
            key={variant['название_пункта']}
            label={`${variant['название_пункта']}${variant['точки'] ? ` (${variant['точки']})` : ''}`}
            value={variant['полное_описание']}
          />
        ))}
      </section>
    )
  }
  if (entity.kind === 'skill' || entity.kind === 'attribute') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.kind === 'skill' ? t('Навык') : t('Атрибут')}: {entity.name}</h3>
        <Field value={entity.data} />
      </section>
    )
  }
  if (entity.kind === 'topic') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.name}</h3>
        <Field value={entity.data} />
      </section>
    )
  }
  return (
    <section className="rules-chat-card">
      <h3>{t('Тип хищника')}: {entity.name}</h3>
      <Field value={entity.data.description} />
      <Field label={t('Специализация')} value={entity.data.specialty} />
      <Field label={t('Дисциплины')} value={entity.data.disciplines} />
    </section>
  )
}

export default function RulesChatPage() {
  const { t } = useLang()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [chronicles, setChronicles] = useState<LibraryChronicle[]>([])
  const [activeChronicle, setActiveChronicle] = useState<LibraryChronicle | null>(null)
  const [chronicleDraft, setChronicleDraft] = useState('')
  const [chronicleBusy, setChronicleBusy] = useState(false)
  const [chronicleError, setChronicleError] = useState('')
  const [preferredEdition, setPreferredEdition] = useState<RulesEditionMode>(DEFAULT_RULES_EDITION)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const client = createClient()
    client.auth.getUser()
      .then(async ({ data }) => {
        if (cancelled) return
        const signedIn = Boolean(data.user)
        setHasSession(signedIn)
        if (!signedIn) return

        const { data: memberships, error } = await client.rpc('list_my_library_chronicles')
        if (cancelled) return
        if (error) {
          console.error('list_my_library_chronicles:', error)
          setChronicleError(t('Не удалось загрузить сохранённые хроники.'))
          return
        }
        const available = Array.isArray(memberships)
          ? memberships.filter(isLibraryChronicle)
          : []
        setChronicles(available)
        const recent = available[0] || null
        setActiveChronicle(recent)
        if (recent) setChronicleDraft(recent.title)
      })
      .catch(() => {
        if (!cancelled) setHasSession(false)
      })
    void loadRules()
    return () => { cancelled = true }
  }, [t])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const openChronicle = useCallback(async () => {
    const title = chronicleDraft.trim()
    if (!title || chronicleBusy) return
    setChronicleBusy(true)
    setChronicleError('')
    try {
      const { data, error } = await createClient().rpc('open_library_chronicle', { p_title: title })
      if (error) throw error
      const opened = Array.isArray(data) ? data.find(isLibraryChronicle) : null
      if (!opened) {
        setChronicleError(t('Хроника с таким названием не найдена. Проверь написание.'))
        return
      }
      if (activeChronicle?.id !== opened.id) setMessages([])
      setActiveChronicle(opened)
      setChronicleDraft(opened.title)
      setChronicles(previous => [opened, ...previous.filter(item => item.id !== opened.id)])
    } catch (error) {
      console.error('open_library_chronicle:', error)
      setChronicleError(t('Не удалось открыть хронику. Проверь вход в аккаунт и попробуй ещё раз.'))
    } finally {
      setChronicleBusy(false)
    }
  }, [activeChronicle?.id, chronicleBusy, chronicleDraft, t])

  const ask = useCallback(async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || busy) return
    setDraft('')
    setBusy(true)
    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    try {
      const rules = await loadRules()
      const parsed = parseQuery(trimmed, rules, preferredEdition)
      const tokens = trimmed.split(/\s+/).map(normalizeToken).filter(Boolean)
      const previousUserQuestions = messages
        .filter((message): message is Extract<ChatMessage, { role: 'user' }> => message.role === 'user')
        .map(message => message.text)
      const bookPlan = buildBookSearchPlan(trimmed, previousUserQuestions, preferredEdition)

      // Дневник остаётся локальным на устройстве. Листы персонажей и страницы
      // книг теперь запрашивает сама модель через безопасные read-only
      // инструменты Edge Function в контексте текущей Auth-сессии.
      let journal: JournalHit[] = []
      let legacyUserId: string | null = null
      try {
        const savedUser = window.localStorage.getItem('vtm-chat-user') || window.localStorage.getItem('vtm-sheet-user')
        legacyUserId = savedUser ? (JSON.parse(savedUser) as { id?: string }).id || null : null
      } catch { /* нет сохранённого пользователя */ }

      if (parsed.journal) {
        journal = searchJournal(tokens, legacyUserId)
      }

      const refHits = parsed.journal || bookPlan.isLibraryQuestion || !bookPlan.referenceQuery
        ? []
        : await searchReference(bookPlan.referenceQuery)
      let hits: BookHit[] = []
      let chronicleHits: ChronicleHit[] = []

      // «Мозг»: DeepSeek через edge-функцию. Отвечает только по нашим
      // материалам; при недоступности — прежний локальный ответ.
      let aiAnswer = ''
      try {
        const history = messages
          .slice(-8)
          .map(message => ({ role: message.role, text: message.text }))
        const context = {
          library: RULEBOOK_LIBRARY.map(book => ({
            source: book.source,
            edition: book.edition,
            title: book.title,
            preferred: preferredEdition !== 'general' && book.edition === preferredEdition,
          })),
          rules: parsed.entities.map(entity => ({
            name: entity.name,
            body: asText(entity.data) || '',
          })),
          reference: refHits.map(hit => ({
            doc: hit.doc.shortTitle,
            section: hit.title,
            snippet: hit.snippet,
          })),
          journal: journal.map(entry => ({
            title: entry.title,
            date: entry.date,
            excerpt: entry.excerpt,
          })),
          chronicle: activeChronicle
            ? { id: activeChronicle.id, title: activeChronicle.title }
            : undefined,
        }
        const { data: aiData, error: aiError } = await createClient().functions.invoke('librarian-chat', {
          body: { question: trimmed, history, preferredEdition, context },
        })
        if (aiError) {
          console.error('librarian-chat:', aiError)
        } else {
          const result = aiData as { answer?: unknown; books?: unknown; chronicle?: unknown }
          aiAnswer = typeof result?.answer === 'string' ? result.answer.trim() : ''
          hits = Array.isArray(result?.books) ? result.books.filter(isBookHit) : []
          chronicleHits = Array.isArray(result?.chronicle)
            ? result.chronicle.filter(isChronicleHit)
            : []
        }
      } catch (error) {
        console.error('librarian-chat не ответил:', error)
      }

      const hasAnything = aiAnswer.length > 0 || bookPlan.isLibraryQuestion
        || journal.length > 0
        || parsed.entities.length > 0 || refHits.length > 0 || hits.length > 0
        || chronicleHits.length > 0
      setMessages(prev => [
        ...prev,
        hasAnything
          ? {
              role: 'assistant',
              text: aiAnswer
                || (bookPlan.isLibraryQuestion
                  ? t('В библиотеке доступны VTM V5 и VTM V20 на русском языке.')
                  : journal.length
                  ? t('Вот что нашлось в твоём архиве:')
                  : parsed.entities.length
                    ? t('Вот что я знаю об этом:')
                    : t('Вот что нашлось в книгах:')),
              journal,
              entities: aiAnswer ? [] : parsed.entities,
              refHits,
              hits,
              chronicle: chronicleHits,
            }
          : {
              role: 'assistant',
              text: parsed.journal
                ? t('В дневнике ничего не нашлось.')
                : t('Не удалось найти подходящий фрагмент. Попробуй уточнить редакцию или назвать термин из правил.'),
            },
      ])
    } catch (error) {
      console.error('Чат-библиотекарь: ошибка ответа:', error)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: t('Не получилось выполнить поиск. Проверь, что ты вошёл в аккаунт, и попробуй ещё раз.') },
      ])
    } finally {
      setBusy(false)
    }
  }, [activeChronicle, busy, messages, preferredEdition, t])

  return (
    <main className="rules-chat-shell">
      <header className="rules-chat-header">
        <div>
          <h1>{t('Библиотекарь')}</h1>
          <p>{t('Спроси о правилах или своих персонажах — найду данные в книгах и архиве.')}</p>
        </div>
        <Link href="/" className="rules-chat-home">
          {t('В салон')}
        </Link>
      </header>

      {hasSession === false ? (
        <section className="rules-chat-locked">
          <p>{t('Тексты книг доступны только своим. Войди в аккаунт на главной странице и возвращайся.')}</p>
          <Link href="/" className="rules-chat-cta">{t('Войти')}</Link>
        </section>
      ) : (
        <>
          <section className="rules-chat-chronicle">
            <div className="rules-chat-chronicle-copy">
              <strong>{t('Хроника игры')}</strong>
              <span>
                {activeChronicle
                  ? t('Последняя открытая хроника выбрана автоматически. Чтобы сменить её, введи другое название.')
                  : t('Введи название игры один раз — в следующий раз эта хроника откроется автоматически.')}
              </span>
            </div>
            <form
              className="rules-chat-chronicle-form"
              onSubmit={event => {
                event.preventDefault()
                void openChronicle()
              }}
            >
              <input
                value={chronicleDraft}
                onChange={event => {
                  setChronicleDraft(event.target.value)
                  setChronicleError('')
                }}
                placeholder={t('Название хроники')}
                list="rules-chat-chronicles"
                disabled={chronicleBusy}
                autoComplete="off"
              />
              <datalist id="rules-chat-chronicles">
                {chronicles.map(chronicle => (
                  <option key={chronicle.id} value={chronicle.title} />
                ))}
              </datalist>
              <button type="submit" disabled={chronicleBusy || !chronicleDraft.trim()}>
                {chronicleBusy ? t('Открываю...') : t('Открыть хронику')}
              </button>
            </form>
            {activeChronicle ? (
              <small className="rules-chat-chronicle-active">
                {t('Активна')}: {activeChronicle.title}. {t('ИИ видит её материалы только в рамках твоего доступа.')}
              </small>
            ) : null}
            {chronicleError ? <small className="rules-chat-chronicle-error">{chronicleError}</small> : null}
          </section>

          <section className="rules-chat-edition">
            <div className="rules-chat-edition-copy">
              <strong>{t('Редакция правил')}</strong>
              <small>{t('Редакция')}: {t(RULES_EDITION_LABELS[preferredEdition])}</small>
            </div>
            <div className="rules-chat-edition-segments" role="group" aria-label={t('Редакция правил')}>
              {RULES_EDITION_MODES.map(edition => (
                <button
                  key={edition}
                  type="button"
                  className={edition === preferredEdition ? 'is-active' : undefined}
                  aria-pressed={edition === preferredEdition}
                  onClick={() => setPreferredEdition(edition)}
                >
                  {t(RULES_EDITION_LABELS[edition])}
                </button>
              ))}
            </div>
          </section>

          <div className="rules-chat-messages" ref={listRef}>
            {messages.length === 0 ? (
              <section className="rules-chat-empty">
                <p>{t('Например:')}</p>
                <div className="rules-chat-suggestions">
                  {SUGGESTIONS.map(suggestion => (
                    <button key={suggestion} type="button" onClick={() => void ask(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {messages.map((message, index) => (
              <article key={index} className={`rules-chat-message ${message.role}`}>
                {message.role === 'assistant' ? (
                  <div className="rules-chat-answer">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.text}</p>
                )}
                {message.role === 'assistant' && message.journal?.length ? (
                  <div className="rules-chat-hits">
                    <small className="rules-chat-hits-title">{t('Из дневника:')}</small>
                    {message.journal.map((entry, entryIndex) => (
                      <blockquote key={entryIndex}>
                        <span>{entry.excerpt}</span>
                        <footer>{entry.title}{entry.date ? ` — ${entry.date}` : ''}</footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.entities?.length ? (
                  <div className="rules-chat-entities">
                    {message.entities.map(entity => (
                      <EntityCard key={`${entity.kind}-${entity.name}`} entity={entity} />
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.refHits?.length ? (
                  <div className="rules-chat-hits">
                    <small className="rules-chat-hits-title">{t('В справочнике:')}</small>
                    {message.refHits.map(hit => (
                      <blockquote key={hit.url}>
                        <span>{hit.snippet}</span>
                        <footer>
                          <Link href={hit.url} className="rules-chat-ref-link">
                            {hit.doc.shortTitle} → {hit.title}
                          </Link>
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.hits?.length ? (
                  <div className="rules-chat-hits">
                    <small className="rules-chat-hits-title">{t('В книгах об этом:')}</small>
                    {message.hits.map(hit => (
                      <blockquote key={`${hit.source}-${hit.page}`}>
                        <span dangerouslySetInnerHTML={renderSnippet(hit.snippet)} />
                        <footer>
                          {hit.title} — {t('стр.')} {hit.page}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.chronicle?.length ? (
                  <div className="rules-chat-hits">
                    <small className="rules-chat-hits-title">{t('Из хроники:')}</small>
                    {message.chronicle.map(hit => (
                      <blockquote key={`${hit.chronicle_id}-${hit.document_title}-${hit.chunk_index}`}>
                        <span dangerouslySetInnerHTML={renderSnippet(hit.snippet)} />
                        <footer>
                          {hit.document_title}{hit.section_title ? ` — ${hit.section_title}` : ''}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {busy ? <article className="rules-chat-message assistant"><p>{t('Ищу в архиве и книгах...')}</p></article> : null}
          </div>

          <form
            className="rules-chat-input"
            onSubmit={event => {
              event.preventDefault()
              void ask(draft)
            }}
          >
            <input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder={t('Спроси про правило, дисциплину, ритуал...')}
              disabled={busy}
              autoFocus
            />
            <button type="submit" disabled={busy || !draft.trim()}>
              {t('Спросить')}
            </button>
          </form>
        </>
      )}

      <style jsx global>{`
        .rules-chat-shell {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at 20% 0%, #1a0b0e 0%, #080506 55%);
          color: #f4eadf;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          padding: 24px clamp(16px, 6vw, 96px);
        }
        .rules-chat-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          border-bottom: 1px solid rgba(139, 0, 0, 0.35);
          padding-bottom: 16px;
        }
        .rules-chat-header h1 {
          font-family: 'Cinzel', serif;
          font-size: clamp(24px, 4vw, 34px);
          margin: 0 0 4px;
          color: #d8b56a;
        }
        .rules-chat-header p {
          margin: 0;
          opacity: 0.75;
          font-size: 14px;
        }
        .rules-chat-home {
          color: #d8b56a;
          text-decoration: none;
          font-size: 14px;
          border: 1px solid rgba(216, 181, 106, 0.4);
          border-radius: 999px;
          padding: 8px 16px;
          white-space: nowrap;
        }
        .rules-chat-home:hover { background: rgba(216, 181, 106, 0.12); }
        .rules-chat-locked {
          margin: auto;
          text-align: center;
          max-width: 420px;
        }
        .rules-chat-cta {
          display: inline-block;
          margin-top: 12px;
          color: #f4eadf;
          background: #8b0000;
          padding: 10px 24px;
          border-radius: 8px;
          text-decoration: none;
        }
        .rules-chat-chronicle {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(300px, 1.2fr);
          gap: 8px 20px;
          align-items: center;
          margin-top: 16px;
          padding: 14px 16px;
          border: 1px solid rgba(216, 181, 106, 0.28);
          border-radius: 12px;
          background: rgba(216, 181, 106, 0.06);
        }
        .rules-chat-chronicle-copy {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .rules-chat-chronicle-copy strong {
          color: #d8b56a;
          font-family: 'Cinzel', serif;
        }
        .rules-chat-chronicle-copy span {
          font-size: 12px;
          line-height: 1.4;
          opacity: 0.72;
        }
        .rules-chat-chronicle-form {
          display: flex;
          gap: 8px;
        }
        .rules-chat-chronicle-form input {
          min-width: 0;
          flex: 1;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(216, 181, 106, 0.3);
          border-radius: 9px;
          color: #f4eadf;
          padding: 9px 12px;
          outline: none;
        }
        .rules-chat-chronicle-form input:focus { border-color: #d8b56a; }
        .rules-chat-chronicle-form button {
          border: 1px solid rgba(216, 181, 106, 0.42);
          border-radius: 9px;
          background: rgba(139, 0, 0, 0.62);
          color: #f4eadf;
          padding: 9px 16px;
          cursor: pointer;
        }
        .rules-chat-chronicle-form button:disabled { opacity: 0.5; cursor: default; }
        .rules-chat-chronicle-active,
        .rules-chat-chronicle-error {
          grid-column: 1 / -1;
          font-size: 12px;
        }
        .rules-chat-chronicle-active { color: #c9dda6; }
        .rules-chat-chronicle-error { color: #ffaaa5; }
        .rules-chat-edition {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px 20px;
          margin-top: 10px;
          padding: 10px 16px;
          border: 1px solid rgba(216, 181, 106, 0.22);
          border-radius: 12px;
          background: rgba(216, 181, 106, 0.04);
        }
        .rules-chat-edition-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rules-chat-edition-copy strong {
          color: #d8b56a;
          font-family: 'Cinzel', serif;
        }
        .rules-chat-edition-copy small {
          color: #c9dda6;
          font-size: 12px;
        }
        .rules-chat-edition-segments {
          display: inline-flex;
          overflow: hidden;
          border: 1px solid rgba(216, 181, 106, 0.38);
          border-radius: 9px;
          background: rgba(0, 0, 0, 0.35);
        }
        .rules-chat-edition-segments button {
          min-width: 72px;
          border: 0;
          border-right: 1px solid rgba(216, 181, 106, 0.25);
          background: transparent;
          color: #f4eadf;
          padding: 8px 14px;
          cursor: pointer;
          font-size: 13px;
        }
        .rules-chat-edition-segments button:last-child { border-right: 0; }
        .rules-chat-edition-segments button:hover { background: rgba(216, 181, 106, 0.1); }
        .rules-chat-edition-segments button.is-active {
          background: rgba(139, 0, 0, 0.78);
          color: #fff4e2;
          box-shadow: inset 0 0 0 1px rgba(216, 181, 106, 0.2);
        }
        .rules-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .rules-chat-empty { margin: auto; text-align: center; opacity: 0.9; }
        .rules-chat-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-top: 12px;
        }
        .rules-chat-suggestions button {
          background: rgba(139, 0, 0, 0.18);
          border: 1px solid rgba(139, 0, 0, 0.5);
          color: #f4eadf;
          border-radius: 999px;
          padding: 8px 14px;
          cursor: pointer;
          font-size: 13px;
        }
        .rules-chat-suggestions button:hover { background: rgba(139, 0, 0, 0.35); }
        .rules-chat-message {
          max-width: 820px;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          line-height: 1.55;
        }
        .rules-chat-message p { margin: 0; white-space: pre-line; }
        .rules-chat-answer p { margin: 0 0 10px; white-space: normal; }
        .rules-chat-answer > *:last-child { margin-bottom: 0; }
        .rules-chat-answer strong { color: #f0d9a8; }
        .rules-chat-answer em { color: #d8b56a; }
        .rules-chat-answer ul,
        .rules-chat-answer ol { margin: 0 0 10px; padding-left: 22px; }
        .rules-chat-answer li { margin: 4px 0; }
        .rules-chat-answer li::marker { color: #d8b56a; }
        .rules-chat-answer h1,
        .rules-chat-answer h2,
        .rules-chat-answer h3,
        .rules-chat-answer h4 {
          margin: 12px 0 6px;
          font-family: 'Cinzel', serif;
          font-size: 16px;
          color: #d8b56a;
        }
        .rules-chat-answer blockquote {
          margin: 0 0 10px;
          padding: 8px 12px;
          border-left: 3px solid #8b0000;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 0 8px 8px 0;
        }
        .rules-chat-answer code {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 13px;
        }
        .rules-chat-answer a { color: #d8b56a; }
        .rules-chat-answer hr {
          border: none;
          border-top: 1px solid rgba(216, 181, 106, 0.25);
          margin: 12px 0;
        }
        .rules-chat-message.user {
          align-self: flex-end;
          background: rgba(139, 0, 0, 0.3);
          border: 1px solid rgba(139, 0, 0, 0.5);
        }
        .rules-chat-message.assistant {
          align-self: flex-start;
          background: rgba(216, 181, 106, 0.07);
          border: 1px solid rgba(216, 181, 106, 0.22);
        }
        .rules-chat-entities { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
        .rules-chat-card {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(216, 181, 106, 0.35);
          border-radius: 10px;
          padding: 14px 16px;
        }
        .rules-chat-card h3 {
          margin: 0 0 8px;
          font-family: 'Cinzel', serif;
          color: #d8b56a;
          font-size: 17px;
        }
        .rules-chat-card p { margin: 0 0 8px; white-space: pre-line; }
        .rules-chat-card p:last-child { margin-bottom: 0; }
        .rules-chat-card-level { margin-top: 10px; }
        .rules-chat-card-level > strong { color: #d8b56a; display: block; margin-bottom: 4px; }
        .rules-chat-card-power { margin: 0 0 8px 12px; font-size: 14px; }
        .rules-chat-card-power em { color: #f0d9a8; font-style: normal; font-weight: 600; }
        .rules-chat-card-power small { display: block; opacity: 0.75; margin-left: 0; }
        .rules-chat-hits { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .rules-chat-hits-title { opacity: 0.7; font-style: italic; }
        .rules-chat-hits blockquote {
          margin: 0;
          padding: 10px 14px;
          border-left: 3px solid #8b0000;
          background: rgba(0, 0, 0, 0.35);
          border-radius: 0 8px 8px 0;
          font-size: 14px;
        }
        .rules-chat-hits blockquote > span {
          display: block;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          line-height: 1.6;
          opacity: 0.92;
        }
        .rules-chat-hits blockquote b { color: #d8b56a; font-style: normal; }
        .rules-chat-hits blockquote footer {
          margin-top: 8px;
          font-size: 12px;
          font-style: normal;
          color: #d8b56a;
          opacity: 0.85;
        }
        .rules-chat-ref-link { color: #d8b56a; text-decoration: none; }
        .rules-chat-ref-link:hover { text-decoration: underline; }
        .rules-chat-input {
          display: flex;
          gap: 10px;
          padding-top: 16px;
          border-top: 1px solid rgba(139, 0, 0, 0.35);
        }
        .rules-chat-input input {
          flex: 1;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(216, 181, 106, 0.3);
          border-radius: 10px;
          color: #f4eadf;
          padding: 12px 16px;
          font-size: 15px;
          outline: none;
        }
        .rules-chat-input input:focus { border-color: #d8b56a; }
        .rules-chat-input button {
          background: #8b0000;
          color: #f4eadf;
          border: none;
          border-radius: 10px;
          padding: 12px 22px;
          font-size: 15px;
          cursor: pointer;
        }
        .rules-chat-input button:disabled { opacity: 0.5; cursor: default; }
        @media (max-width: 720px) {
          .rules-chat-chronicle { grid-template-columns: 1fr; }
          .rules-chat-chronicle-form { flex-direction: column; }
          .rules-chat-chronicle-form button { width: 100%; }
          .rules-chat-edition { align-items: stretch; flex-direction: column; }
          .rules-chat-edition-segments { display: flex; width: 100%; }
          .rules-chat-edition-segments button { flex: 1; min-width: 0; }
        }
      `}</style>
    </main>
  )
}
