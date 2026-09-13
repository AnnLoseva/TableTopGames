'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAccount } from '@/platform/account/AccountProvider'
import styles from './AdminPages.module.css'

/**
 * The author's door. Sign-in itself is the shared TableTopGames account layer
 * (`AccountProvider`); this page only decides where to go afterwards. Being
 * signed in as *someone* is not enough to reach the chronicle's admin — the
 * account has to be the author's, which the server layout and, underneath it,
 * every RLS policy check independently.
 */
export default function LoginRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { account, isReady, isBusy, authenticate } = useAccount()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const next = searchParams.get('next') || '/chronicle/admin'

  useEffect(() => {
    if (isReady && account) router.replace(next)
  }, [isReady, account, next, router])

  const submit = async () => {
    setError('')
    try {
      await authenticate('login', username, password)
      router.replace(next)
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Не удалось войти.')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="ch-kicker">Вход</p>
          <h1 className={styles.pageTitle}>Кабинет автора</h1>
        </div>
      </header>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Имя пользователя</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={event => setUsername(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void submit() }}
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.formActions}>
          <button type="button" className={styles.primaryButton} onClick={submit} disabled={isBusy}>
            {isBusy ? 'Вхожу…' : 'Войти'}
          </button>
        </div>
        <p className={styles.hint}>Тот же аккаунт, что и для карты отношений.</p>
      </div>
    </div>
  )
}
