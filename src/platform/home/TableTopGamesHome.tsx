'use client'

import Link from 'next/link'
import { type FormEvent, useEffect, useState } from 'react'
import {
  type AccountAuthMode,
  useAccount,
} from '@/platform/account/AccountProvider'
import styles from './TableTopGamesHome.module.css'

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>
}

function AccountDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { account, authenticate, isBusy, signOut } = useAccount()
  const [mode, setMode] = useState<AccountAuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(mode === 'login' ? 'Проверяю доступ…' : 'Создаю аккаунт…')
    try {
      await authenticate(mode, username, password)
      setUsername('')
      setPassword('')
      setMessage('Вход выполнен. Аккаунт доступен во всех играх.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось выполнить вход.')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setMessage('Вы вышли из аккаунта.')
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.dialogClose}
          onClick={onClose}
          aria-label="Закрыть окно аккаунта"
        >
          ×
        </button>

        <p className={styles.eyebrow}>Единый профиль</p>
        <h2 id="account-dialog-title">
          {account ? `Добро пожаловать, ${account.username}` : 'Аккаунт TableTopGames'}
        </h2>
        <p className={styles.dialogLead}>
          Используется существующий аккаунт Vampire. Сессия и игровые данные
          сохраняются для всех страниц этого сайта.
        </p>

        {account ? (
          <div className={styles.accountSummary}>
            <span className={styles.accountAvatar} aria-hidden="true">
              {account.username.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{account.username}</strong>
              <small>Сессия активна на этом устройстве</small>
            </div>
            <button type="button" onClick={handleSignOut} disabled={isBusy}>
              Выйти
            </button>
          </div>
        ) : (
          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.authTabs} role="tablist" aria-label="Режим аккаунта">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? styles.activeTab : ''}
                onClick={() => {
                  setMode('login')
                  setMessage('')
                }}
              >
                Вход
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={mode === 'register' ? styles.activeTab : ''}
                onClick={() => {
                  setMode('register')
                  setMessage('')
                }}
              >
                Регистрация
              </button>
            </div>
            <label>
              <span>Имя пользователя</span>
              <input
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
                minLength={3}
                required
              />
            </label>
            <label>
              <span>Пароль</span>
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </label>
            <button type="submit" className={styles.submitButton} disabled={isBusy}>
              {isBusy ? 'Подождите…' : mode === 'login' ? 'Войти в аккаунт' : 'Создать аккаунт'}
            </button>
          </form>
        )}

        <p className={styles.authMessage} role="status">{message}</p>
      </section>
    </div>
  )
}

export default function TableTopGamesHome() {
  const { account, isReady } = useAccount()
  const [isAccountOpen, setIsAccountOpen] = useState(false)

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="TableTopGames — главная">
          <span className={styles.brandMark}>TT</span>
          <span>
            <strong>TableTopGames</strong>
            <small>единое пространство для настольных историй</small>
          </span>
        </Link>
        <button
          type="button"
          className={styles.accountButton}
          onClick={() => setIsAccountOpen(true)}
        >
          <span className={styles.accountDot} data-active={Boolean(account)} />
          {!isReady ? 'Проверяю аккаунт…' : account ? account.username : 'Зайти в аккаунт'}
        </button>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Choose your table</p>
          <h1>
            Одна дверь.
            <span>Два мира.</span>
          </h1>
          <p className={styles.heroLead}>
            Выберите игру, продолжите сохранённую историю или войдите в общий
            аккаунт, чтобы ваши данные оставались с вами на всех страницах.
          </p>
        </div>

        <div className={styles.gameGrid}>
          <Link href="/vampires" className={`${styles.gameCard} ${styles.vampiresCard}`}>
            <div className={styles.cardNumber}>01</div>
            <div className={styles.cardCopy}>
              <p>World of Darkness</p>
              <h2>Vampire</h2>
              <span>The Masquerade</span>
            </div>
            <div className={styles.cardAction}>
              Перейти на сайт Вампиров
              <ArrowIcon />
            </div>
          </Link>

          <Link href="/pathfinder2/sheet" className={`${styles.gameCard} ${styles.pathfinderCard}`}>
            <div className={styles.cardNumber}>02</div>
            <div className={styles.cardCopy}>
              <p>Second Edition</p>
              <h2>Pathfinder</h2>
              <span>Мастерская персонажа</span>
            </div>
            <div className={styles.cardAction}>
              Перейти на сайт Pathfinder
              <ArrowIcon />
            </div>
          </Link>

          <Link href="/dnd/journal" className={`${styles.gameCard} ${styles.dndCard}`}>
            <div className={styles.cardNumber}>03</div>
            <div className={styles.cardCopy}>
              <p>RenaCompanion</p>
              <h2>D&D журнал</h2>
              <span>Синхронизировано с iPad</span>
            </div>
            <div className={styles.cardAction}>
              Открыть журнал похода
              <ArrowIcon />
            </div>
          </Link>

          <button
            type="button"
            className={`${styles.gameCard} ${styles.accountCard}`}
            onClick={() => setIsAccountOpen(true)}
          >
            <div className={styles.cardNumber}>ID</div>
            <div className={styles.cardCopy}>
              <p>Shared profile</p>
              <h2>{account ? account.username : 'Аккаунт'}</h2>
              <span>{account ? 'Данные синхронизированы' : 'Общая сессия для всех игр'}</span>
            </div>
            <div className={styles.cardAction}>
              {account ? 'Управлять аккаунтом' : 'Зайти в аккаунт'}
              <ArrowIcon />
            </div>
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>TableTopGames · 2026</span>
        <span>Один аккаунт · несколько игровых миров</span>
      </footer>

      <AccountDialog
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />
    </main>
  )
}
