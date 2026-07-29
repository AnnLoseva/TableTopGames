'use client'

import Link from 'next/link'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type TableRole = 'master' | 'player'
type Accent = 'gold' | 'red' | 'cyan'
type AuthMode = 'login' | 'register'

type ChatUser = {
  id: string
  username: string
}

type CharacterOption = {
  id: string
  name: string
  clan: string | null
  image: string
}

type CharacterRow = {
  id: string
  name: string
  clan: string | null
  data: {
    characterImage?: string
    image?: string
    portrait?: string
  } | null
}

const DEFAULT_ROOM = 'campaign-666'

function clearRememberedUser() {
  window.localStorage.removeItem('vtm-chat-user')
  window.localStorage.removeItem('vtm-sheet-user')
}

function storeRememberedUser(user: ChatUser) {
  const value = JSON.stringify(user)
  window.localStorage.setItem('vtm-chat-user', value)
  window.localStorage.setItem('vtm-sheet-user', value)
}

const particles = Array.from({ length: 36 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  top: `${(index * 53) % 100}%`,
  delay: `${(index % 9) * 0.7}s`,
  duration: `${7 + (index % 6)}s`,
  size: `${2 + (index % 3)}px`,
}))

function sanitizeRoom(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_.-]/g, '')
    .slice(0, 48)
}

function Sigil({ children }: { children: ReactNode }) {
  return (
    <span className="sigil" aria-hidden="true">
      {children}
    </span>
  )
}

function EntryCard({
  accent,
  title,
  description,
  button,
  children,
}: {
  accent: Accent
  title: string
  description: string
  button: ReactNode
  children: ReactNode
}) {
  return (
    <motion.article
      className={`elysium-card ${accent}`}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.015 }}
    >
      <div className="card-corners" aria-hidden="true" />
      {children}
      <h2>{title}</h2>
      <p>{description}</p>
      {button}
    </motion.article>
  )
}

export default function MainScreen() {
  const { lang, setLang, t } = useLang()
  const [roomDraft, setRoomDraft] = useState(DEFAULT_ROOM)
  const [role, setRole] = useState<TableRole>('player')
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [characters, setCharacters] = useState<CharacterOption[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [usernameDraft, setUsernameDraft] = useState('')
  const [passwordDraft, setPasswordDraft] = useState('')
  const [authStatus, setAuthStatus] = useState('Private archive access')
  const [isAuthBusy, setIsAuthBusy] = useState(true)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothX = useSpring(mouseX, { stiffness: 45, damping: 22 })
  const smoothY = useSpring(mouseY, { stiffness: 45, damping: 22 })
  const backgroundX = useTransform(smoothX, [-1, 1], [-16, 16])
  const backgroundY = useTransform(smoothY, [-1, 1], [-12, 12])

  useEffect(() => {
    let cancelled = false
    const savedRoom = window.localStorage.getItem('vtm-table-room')
    const savedRole = window.localStorage.getItem('vtm-table-role')

    if (savedRoom) setRoomDraft(savedRoom)
    if (savedRole === 'master' || savedRole === 'player') setRole(savedRole)

    const restoreArchiveSession = async () => {
      const supabase = createClient()
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (cancelled) return
        if (authError?.name !== 'AuthSessionMissingError') {
          if (authError) throw authError
        }
        if (!authData.user) {
          clearRememberedUser()
          setChatUser(null)
          setAuthStatus('Private archive access')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, username')
          .eq('auth_user_id', authData.user.id)
          .maybeSingle()
        if (cancelled) return
        if (profileError || !profile) {
          clearRememberedUser()
          setChatUser(null)
          setAuthStatus('Сессия архива недействительна. Войдите снова.')
          await supabase.auth.signOut({ scope: 'local' })
          return
        }

        const user = profile as ChatUser
        storeRememberedUser(user)
        setChatUser(user)
        setAuthStatus(`Session: ${user.username}`)
      } catch (error) {
        console.error('Не удалось восстановить Supabase Auth-сессию:', error)
        if (!cancelled) {
          clearRememberedUser()
          setChatUser(null)
          setAuthStatus('Не удалось проверить сессию. Войдите снова.')
        }
      } finally {
        if (!cancelled) setIsAuthBusy(false)
      }
    }

    void restoreArchiveSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!chatUser) {
      setCharacters([])
      setSelectedCharacterId('')
      return
    }

    let cancelled = false
    createClient()
      .from('characters')
      // лёгкий select: тянем только URL портрета, а не весь data (в ~90 раз меньше)
      .select('id, name, clan, image:data->>characterImage')
      .eq('user_id', chatUser.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить персонажей:', error)
          setAuthStatus(t('Архив вошёл, но персонажи не загрузились'))
          return
        }

        const nextCharacters = (data || []).map(row => {
          const character = row as { id: string; name: string; clan: string | null; image: string | null }
          return {
            id: character.id,
            name: character.name,
            clan: character.clan,
            image: character.image || '',
          }
        })
        setCharacters(nextCharacters)
        const savedId = window.localStorage.getItem(`vtm-chat-character:${chatUser.id}`) || window.localStorage.getItem(`vtm-home-character:${chatUser.id}`)
        const nextId = savedId && nextCharacters.some(character => character.id === savedId)
          ? savedId
          : nextCharacters[0]?.id || ''
        setSelectedCharacterId(nextId)
        if (nextId) {
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, nextId)
          window.localStorage.setItem(`vtm-home-character:${chatUser.id}`, nextId)
        }
        setAuthStatus(`Session: ${chatUser.username}`)
      })

    return () => {
      cancelled = true
    }
  }, [chatUser])

  const room = useMemo(() => sanitizeRoom(roomDraft) || DEFAULT_ROOM, [roomDraft])
  const tableHref = `/vampires/table?room=${encodeURIComponent(room)}&role=${role}`
  const masterHref = `/vampires/master?room=${encodeURIComponent(room)}`
  const sheetHref = `/vampires/character-sheet?room=${encodeURIComponent(room)}&role=${role}${selectedCharacterId ? `&characterId=${encodeURIComponent(selectedCharacterId)}` : ''}`
  const newSheetHref = `/vampires/character-sheet?room=${encodeURIComponent(room)}&role=${role}&new=1`

  const rememberTableChoice = (nextRole = role) => {
    window.localStorage.setItem('vtm-table-room', room)
    window.localStorage.setItem('vtm-table-role', nextRole)
  }

  const enterTable = (nextRole = role) => {
    rememberTableChoice(nextRole)
    window.location.href = `/vampires/table?room=${encodeURIComponent(room)}&role=${nextRole}`
  }

  const handleRoomSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    enterTable(role)
  }

  // Deterministic synthetic email for Supabase Auth: first 32 hex chars of
  // sha256(username) @vtm.local. Must match public.archive_email_for_username in SQL.
  const archiveEmail = async (username: string) => {
    const bytes = new TextEncoder().encode(username)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes)
    const hex = Array.from(new Uint8Array(hashBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
    return `${hex.slice(0, 32)}@vtm.local`
  }

  const rememberUser = (user: ChatUser) => {
    storeRememberedUser(user)
    setChatUser(user)
    setUsernameDraft('')
    setPasswordDraft('')
    setAuthStatus(`Session: ${user.username}`)
  }

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = usernameDraft.trim()
    const password = passwordDraft.trim()

    if (username.length < 3) {
      setAuthStatus(t('Имя пользователя минимум 3 символа'))
      return
    }
    if (password.length < 6) {
      setAuthStatus(t('Пароль минимум 6 символов'))
      return
    }

    setIsAuthBusy(true)
    setAuthStatus(authMode === 'login' ? t('Проверяю доступ...') : t('Создаю запись в архиве...'))
    try {
      const supabase = createClient()
      const email = await archiveEmail(username)

      if (authMode === 'register') {
        const { data, error } = await supabase
          .rpc('register_archive_user', { p_username: username, p_password: password })
          .single()

        if (error || !data) {
          console.error('Не удалось зарегистрировать пользователя:', error)
          setAuthStatus(error?.code === '23505' ? t('Такой пользователь уже существует') : t('Регистрация не прошла'))
          return
        }

        const { error: registerSignInError } = await supabase.auth.signInWithPassword({ email, password })
        if (registerSignInError) {
          setAuthStatus(t('Аккаунт создан, но вход не выполнен. Попробуйте войти.'))
          return
        }
        rememberUser(data as ChatUser)
        return
      }

      let { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        // Легаси-аккаунт без auth-записи: проверяем пароль и создаём её на лету.
        const { data: migrated } = await supabase
          .rpc('migrate_legacy_auth', { p_username: username, p_password: password })
          .single()
        if (migrated) {
          ;({ error: signInError } = await supabase.auth.signInWithPassword({ email, password }))
        }
      }

      if (signInError) {
        setAuthStatus(t('Неверный логин или пароль'))
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .single()

      if (error || !data) {
        setAuthStatus(t('Неверный логин или пароль'))
        return
      }

      rememberUser(data as ChatUser)
    } finally {
      setIsAuthBusy(false)
    }
  }

  const logout = () => {
    void createClient().auth.signOut({ scope: 'local' })
    clearRememberedUser()
    setChatUser(null)
    setCharacters([])
    setSelectedCharacterId('')
    setAuthStatus('Private archive access')
  }

  const chooseCharacter = (characterId: string) => {
    setSelectedCharacterId(characterId)
    if (chatUser) {
      window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, characterId)
      window.localStorage.setItem(`vtm-home-character:${chatUser.id}`, characterId)
    }
  }

  const selectedCharacter = characters.find(character => character.id === selectedCharacterId) || characters[0] || null
  return (
    <main
      className="salon-shell"
      onMouseMove={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        mouseX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2)
        mouseY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2)
      }}
    >
      <motion.div className="salon-background" style={{ x: backgroundX, y: backgroundY }} aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <div className="lang-toggle" role="group" aria-label="Language">
        <button type="button" className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>
          RU
        </button>
        <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
          EN
        </button>
      </div>

      <div className="dust-field" aria-hidden="true">
        {particles.map(particle => (
          <span
            key={particle.id}
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <section className="hero-content" aria-label="Vampire companion system">
        <motion.div
          className="title-block"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="pretitle">Elysium Digital Archive</p>
          <h1>
            <span>VAMPIRE</span>
            <span>THE MASQUERADE</span>
            <span>COMPANION SYSTEM</span>
          </h1>
          <div className="divider" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <blockquote>&quot;We are all monsters pretending to be human.&quot;</blockquote>
        </motion.div>

        <section className="card-grid" aria-label="Main entrances">
          <EntryCard
            accent="gold"
            title={t('Архив личности')}
            description={chatUser ? t('Аккаунт активен. Последний персонаж доступен прямо из салона.') : t('Войдите в систему и получите доступ к персонажам, хроникам и сохранённым данным.')}
            button={
              chatUser ? (
                <div className="identity-panel">
                  <div className="character-preview">
                    {selectedCharacter?.image ? (
                      <img src={selectedCharacter.image} alt="" />
                    ) : (
                      <span>{selectedCharacter?.name.slice(0, 1).toUpperCase() || chatUser.username.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <strong>{selectedCharacter?.name || chatUser.username}</strong>
                  <small>{selectedCharacter?.clan || (characters.length ? t('Клан не указан') : t('Персонажей пока нет'))}</small>
                  {characters.length > 1 ? (
                    <select value={selectedCharacterId} onChange={event => chooseCharacter(event.target.value)} aria-label={t('Активный персонаж')}>
                      {characters.map(character => (
                        <option value={character.id} key={character.id}>
                          {character.name}{character.clan ? ` · ${character.clan}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="identity-actions">
                    <Link href={sheetHref} onClick={() => rememberTableChoice(role)} className="card-action">
                      {t('Листы')}
                    </Link>
                    <button type="button" className="ghost-action" onClick={logout}>
                      {t('Выйти')}
                    </button>
                    <Link
                      href={newSheetHref}
                      onClick={() => {
                        rememberTableChoice(role)
                        window.localStorage.removeItem('vtm-character-creation-draft-v2')
                      }}
                      className="ghost-action new-character-action"
                    >
                      {t('Создать нового персонажа')}
                    </Link>
                  </div>
                </div>
              ) : (
                <form className="auth-form" onSubmit={handleAuth}>
                  <div className="auth-tabs">
                    <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
                      {t('Вход')}
                    </button>
                    <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>
                      {t('Регистрация')}
                    </button>
                  </div>
                  <input
                    value={usernameDraft}
                    onChange={event => setUsernameDraft(event.target.value)}
                    placeholder={t('Имя пользователя')}
                    autoComplete="username"
                  />
                  <input
                    value={passwordDraft}
                    onChange={event => setPasswordDraft(event.target.value)}
                    placeholder={t('Пароль')}
                    type="password"
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button type="submit" className="card-action" disabled={isAuthBusy}>
                    {isAuthBusy ? '...' : authMode === 'login' ? t('Войти в аккаунт') : t('Создать аккаунт')}
                  </button>
                  <small className="auth-status" role="status">{authStatus}</small>
                </form>
              )
            }
          >
            <Sigil>◉</Sigil>
          </EntryCard>

          <EntryCard
            accent="red"
            title={t('Хроника')}
            description={t('Подключитесь к игровой комнате, синхронизируйте листы и играйте в реальном времени.')}
            button={
              <form onSubmit={handleRoomSubmit} className="chronicle-form">
                <div className="room-line">
                  <input
                    value={roomDraft}
                    onChange={event => setRoomDraft(event.target.value)}
                    placeholder={t('Название комнаты')}
                    autoComplete="off"
                  />
                  <select
                    value={role}
                    onChange={event => setRole(event.target.value as TableRole)}
                    aria-label={t('Роль')}
                  >
                    <option value="player">{t('Игрок')}</option>
                    <option value="master">{t('Мастер')}</option>
                  </select>
                </div>
                <button type="submit" className="card-action">
                  {t('Войти в игру')}
                </button>
                {role === 'master' ? (
                  <Link
                    href={masterHref}
                    onClick={() => rememberTableChoice('master')}
                    className="ghost-action"
                    style={{ marginTop: 8, display: 'inline-flex' }}
                  >
                    {t('Пульт рассказчика')}
                  </Link>
                ) : null}
              </form>
            }
          >
            <Sigil>♕</Sigil>
          </EntryCard>

          <EntryCard
            accent="cyan"
            title={t('Библиотека')}
            description={t('Знания мира: чат-библиотекарь, справочник, закрытые хроники и дневники.')}
            button={
              <div className="library-actions">
                <Link href="/vampires/library/chat" className="card-action">
                  {t('Чат')}
                </Link>
                <Link href="/vampires/reference" className="ghost-action">
                  {t('Справочник')}
                </Link>
                <Link href="/vampires/library/chronicles" className="ghost-action">
                  {t('Хроника')}
                </Link>
                <Link href="/vampires/journal" className="ghost-action">
                  {t('Дневник')}
                </Link>
              </div>
            }
          >
            <Sigil>✦</Sigil>
          </EntryCard>
        </section>
      </section>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

        .salon-shell {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          overflow-x: clip;
          color: #eee8df;
          background: #030303;
          font-family: Inter, system-ui, sans-serif;
          isolation: isolate;
        }

        .salon-shell::before {
          content: "";
          position: fixed;
          inset: 14px;
          border: 1px solid rgba(178, 126, 71, 0.26);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025), 0 0 70px rgba(0,0,0,0.65);
          pointer-events: none;
          z-index: 4;
        }

        .lang-toggle {
          position: fixed;
          top: 18px;
          right: 18px;
          z-index: 5;
          display: flex;
          gap: 2px;
          padding: 3px;
          border-radius: 999px;
          background: rgba(10, 10, 10, 0.72);
          border: 1px solid rgba(178, 126, 71, 0.35);
          backdrop-filter: blur(6px);
        }

        .lang-toggle button {
          appearance: none;
          border: none;
          background: transparent;
          color: rgba(238, 232, 223, 0.55);
          font-family: Inter, system-ui, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 6px 12px;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .lang-toggle button:hover {
          color: rgba(238, 232, 223, 0.85);
        }

        .lang-toggle button.active {
          background: rgba(178, 126, 71, 0.85);
          color: #0a0a0a;
        }

        .salon-background {
          position: absolute;
          inset: -28px;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.62)),
            linear-gradient(90deg, rgba(0,0,0,0.74), transparent 24%, transparent 76%, rgba(0,0,0,0.76)),
            url('/vampires/landing-background.png') center center / cover no-repeat;
          filter: saturate(0.9) contrast(1.08);
          transform: scale(1.05);
          z-index: -4;
        }

        .salon-background::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 10%, rgba(218, 180, 107, 0.12), transparent 26%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 7vw);
          opacity: 0.58;
        }

        .vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 35%, transparent 0 35%, rgba(0,0,0,0.46) 66%, rgba(0,0,0,0.92) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0.18) 48%, rgba(0,0,0,0.84));
          z-index: -2;
        }

        .vignette::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(0,0,0,0.76), transparent 18%, transparent 82%, rgba(0,0,0,0.78)),
            linear-gradient(180deg, rgba(0,0,0,0.5), transparent 28%, rgba(0,0,0,0.78));
        }

        .dust-field {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .dust-field span {
          position: absolute;
          border-radius: 999px;
          background: rgba(238, 215, 174, 0.7);
          box-shadow: 0 0 18px rgba(238, 215, 174, 0.35);
          animation: drift linear infinite;
          opacity: 0;
        }

        .hero-content {
          min-height: 100vh;
          min-height: 100dvh;
          width: min(1240px, calc(100% - clamp(20px, 5vw, 48px)));
          margin: 0 auto;
          padding: 52px 0 40px;
          display: grid;
          align-content: center;
          gap: clamp(22px, 3.4vh, 38px);
        }

        .title-block {
          text-align: center;
          display: grid;
          justify-items: center;
        }

        .pretitle {
          margin: 0 0 12px;
          color: rgba(214, 176, 108, 0.72);
          font-size: 12px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          display: grid;
          gap: 4px;
          font-family: Cinzel, Georgia, serif;
          font-weight: 500;
          line-height: 0.95;
          letter-spacing: 0.08em;
          text-shadow: 0 10px 38px rgba(0,0,0,0.9);
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        h1 span:first-child {
          font-size: clamp(60px, 8.4vw, 128px);
          color: #e8dfd3;
        }

        h1 span:nth-child(2) {
          font-size: clamp(20px, 3.1vw, 38px);
          color: #ded3c4;
        }

        h1 span:last-child {
          font-size: clamp(16px, 2.1vw, 28px);
          color: #d22f38;
          letter-spacing: 0.28em;
        }

        .divider {
          width: min(520px, 70vw);
          margin: 24px 0 20px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          color: #b52730;
        }

        .divider span {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(181, 39, 48, 0.72));
        }

        .divider span:last-child {
          background: linear-gradient(90deg, rgba(181, 39, 48, 0.72), transparent);
        }

        .divider i {
          width: 15px;
          height: 15px;
          border: 1px solid currentColor;
          transform: rotate(45deg);
        }

        blockquote {
          margin: 0;
          color: rgba(232, 223, 211, 0.78);
          font-family: Cinzel, Georgia, serif;
          font-size: clamp(16px, 2vw, 22px);
          font-style: italic;
        }

        .card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }

        .elysium-card {
          position: relative;
          min-height: 372px;
          min-width: 0;
          padding: 30px 28px;
          display: grid;
          align-content: end;
          justify-items: center;
          gap: 16px;
          text-align: center;
          border: 1px solid color-mix(in srgb, var(--accent) 54%, transparent);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)),
            radial-gradient(circle at 50% 22%, color-mix(in srgb, var(--accent) 19%, transparent), transparent 42%),
            rgba(4, 4, 5, 0.5);
          box-shadow: 0 18px 72px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.03);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        .elysium-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.22) 35%, rgba(0,0,0,0.88) 100%),
            radial-gradient(circle at 50% 33%, transparent, rgba(0,0,0,0.58) 68%),
            var(--card-image) center / cover no-repeat;
          filter: saturate(0.92) contrast(1.1);
          transform: scale(1.01);
          transition: transform 420ms ease, filter 420ms ease;
          z-index: 0;
        }

        .elysium-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, transparent), transparent 30% 70%, color-mix(in srgb, var(--accent) 14%, transparent)),
            linear-gradient(180deg, transparent, rgba(0,0,0,0.36));
          opacity: 0.34;
          transition: opacity 260ms ease;
          z-index: 0;
        }

        .elysium-card:hover::before {
          transform: scale(1.055);
          filter: saturate(1.04) contrast(1.16);
        }

        .elysium-card:hover::after {
          opacity: 0.72;
        }

        .elysium-card.gold {
          --accent: #d7ae68;
          --card-image: url('/vampires/card-account.png');
        }

        .elysium-card.red {
          --accent: #d6313a;
          --card-image: url('/vampires/card-chronicle.png');
        }

        .elysium-card.cyan {
          --accent: #8bd5d7;
          --card-image: url('/vampires/card-character-sheet.png');
        }

        .card-corners {
          position: absolute;
          inset: 8px;
          border-top: 1px solid color-mix(in srgb, var(--accent) 44%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
          pointer-events: none;
          z-index: 2;
        }

        .card-corners::before,
        .card-corners::after {
          content: "";
          position: absolute;
          top: -1px;
          width: 38px;
          height: 38px;
          border-top: 1px solid color-mix(in srgb, var(--accent) 74%, transparent);
        }

        .card-corners::before {
          left: 0;
          border-left: 1px solid color-mix(in srgb, var(--accent) 74%, transparent);
        }

        .card-corners::after {
          right: 0;
          border-right: 1px solid color-mix(in srgb, var(--accent) 74%, transparent);
        }

        .sigil {
          position: relative;
          z-index: 1;
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--accent) 54%, transparent);
          border-radius: 999px;
          color: var(--accent);
          font-family: Cinzel, Georgia, serif;
          font-size: 28px;
          box-shadow: 0 0 36px color-mix(in srgb, var(--accent) 20%, transparent);
          backdrop-filter: blur(6px);
        }

        .elysium-card h2 {
          position: relative;
          z-index: 1;
          margin: 0;
          color: var(--accent);
          font-family: Cinzel, Georgia, serif;
          font-size: clamp(20px, 2vw, 27px);
          font-weight: 500;
          letter-spacing: 0.06em;
        }

        .elysium-card p {
          position: relative;
          z-index: 1;
          min-height: 66px;
          margin: 0;
          color: rgba(232, 223, 211, 0.72);
          line-height: 1.55;
          font-size: 14px;
        }

        .card-action {
          position: relative;
          z-index: 1;
          min-width: 190px;
          max-width: 100%;
          min-height: 42px;
          border: 1px solid color-mix(in srgb, var(--accent) 58%, transparent);
          border-radius: 4px;
          background: rgba(0,0,0,0.28);
          color: #f7f2e8;
          display: inline-grid;
          place-items: center;
          padding: 0 18px;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 12px;
          line-height: 1.25;
          text-align: center;
          transition: background 220ms ease, box-shadow 220ms ease;
          cursor: pointer;
        }

        .card-action:disabled {
          opacity: 0.58;
          cursor: wait;
        }

        .card-action:hover {
          background: color-mix(in srgb, var(--accent) 18%, rgba(0,0,0,0.4));
          box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 18%, transparent);
        }

        .chronicle-form {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 10px;
          width: 100%;
          justify-items: center;
        }

        .auth-form {
          position: relative;
          z-index: 1;
          width: 100%;
          display: grid;
          gap: 9px;
          justify-items: center;
        }

        .auth-status {
          min-height: 16px;
          color: rgba(238, 232, 223, 0.66);
          font-size: 11px;
          line-height: 1.35;
        }

        .auth-tabs {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .auth-tabs button,
        .ghost-action {
          min-height: 34px;
          border: 1px solid rgba(215, 174, 104, 0.22);
          border-radius: 4px;
          background: rgba(0,0,0,0.22);
          color: rgba(238, 232, 223, 0.72);
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .auth-tabs button.active {
          border-color: rgba(215, 174, 104, 0.58);
          color: #f4dfb7;
          background: rgba(215, 174, 104, 0.12);
        }

        .identity-panel {
          position: relative;
          z-index: 1;
          width: 100%;
          min-width: 0;
          display: grid;
          justify-items: center;
          gap: 9px;
        }

        .character-preview {
          width: 96px;
          height: 126px;
          border: 1px solid rgba(215, 174, 104, 0.45);
          background: rgba(0,0,0,0.42);
          box-shadow: 0 12px 34px rgba(0,0,0,0.45), 0 0 22px rgba(215, 174, 104, 0.13);
          overflow: hidden;
          display: grid;
          place-items: center;
          color: #d7ae68;
          font-family: Cinzel, Georgia, serif;
          font-size: 34px;
        }

        .character-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .identity-panel strong {
          color: #f3e5cc;
          font-family: Cinzel, Georgia, serif;
          font-size: 17px;
          font-weight: 500;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .identity-panel small {
          color: rgba(238, 232, 223, 0.62);
        }

        .identity-panel select {
          width: 100%;
          color: #f3dfbd;
        }

        .identity-actions {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }

        .new-character-action {
          grid-column: 1 / -1;
        }

        .library-actions {
          position: relative;
          z-index: 1;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          align-items: center;
        }

        .ghost-action {
          width: 100%;
          min-width: 0;
          height: 42px;
          border-color: rgba(255,255,255,0.14);
          display: inline-grid;
          place-items: center;
          line-height: 1.25;
          text-align: center;
          text-decoration: none;
        }

        .ghost-action:hover {
          border-color: rgba(215, 174, 104, 0.48);
          color: #f4dfb7;
        }

        .library-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 20;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0,0,0,0.72);
        }

        .library-modal {
          width: min(620px, 100%);
          max-height: min(620px, 90vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid rgba(178, 126, 71, 0.38);
          border-radius: 8px;
          background: #101010;
          color: #eee8df;
          box-shadow: 0 28px 80px rgba(0,0,0,0.56);
          overflow: hidden;
        }

        .library-modal header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border-bottom: 1px solid rgba(255,255,255,0.09);
          background: #15110d;
        }

        .library-modal header div {
          display: grid;
          gap: 3px;
        }

        .library-modal header span,
        .library-journal-list span,
        .library-journal-list p {
          color: #b8aa98;
          font-size: 13px;
        }

        .library-modal header strong {
          color: #fff;
        }

        .library-modal header button {
          width: 34px;
          height: 34px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
          color: #fff;
          font: inherit;
          cursor: pointer;
        }

        .library-journal-list {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 8px;
          padding: 14px;
        }

        .library-journal-list a {
          display: grid;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 7px;
          background: rgba(255,255,255,0.045);
          color: #fff;
          padding: 12px;
          text-decoration: none;
        }

        .room-line {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 96px;
          gap: 8px;
          width: 100%;
        }

        input,
        select {
          min-width: 0;
          height: 38px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          background: rgba(0,0,0,0.32);
          color: #eee8df;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
        }

        select {
          color: #f3d2d2;
        }

        @keyframes drift {
          0% {
            transform: translate3d(0, 26px, 0);
            opacity: 0;
          }
          18%,
          76% {
            opacity: 0.75;
          }
          100% {
            transform: translate3d(18px, -60px, 0);
            opacity: 0;
          }
        }

        @media (max-width: 980px) {
          .hero-content {
            align-content: start;
            padding-top: 72px;
          }

          .card-grid {
            grid-template-columns: 1fr;
          }

          .elysium-card {
            min-height: min(372px, 78svh);
          }
        }

        @media (max-width: 620px) {
          .hero-content {
            width: min(100% - 20px, 1180px);
            padding-top: 64px;
          }

          .elysium-card {
            min-height: 300px;
            padding: 22px;
          }

          h1 span:first-child {
            font-size: clamp(42px, 15vw, 60px);
          }

          h1 span:last-child {
            letter-spacing: 0.12em;
          }

          .identity-actions {
            grid-template-columns: 1fr;
          }

          .card-action {
            width: 100%;
            min-width: 0;
          }

          .room-line {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
