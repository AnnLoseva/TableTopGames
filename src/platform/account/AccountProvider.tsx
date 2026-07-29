'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createAccountClient } from './supabase'

export type Account = {
  id: string
  username: string
}

export type AccountAuthMode = 'login' | 'register'

type AccountContextValue = {
  account: Account | null
  isReady: boolean
  isBusy: boolean
  authenticate: (
    mode: AccountAuthMode,
    username: string,
    password: string,
  ) => Promise<void>
  signOut: () => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)
const ACCOUNT_STORAGE_KEY = 'tabletop-account'
const LEGACY_ACCOUNT_KEYS = ['vtm-chat-user', 'vtm-sheet-user'] as const

function clearStoredAccount() {
  window.localStorage.removeItem(ACCOUNT_STORAGE_KEY)
  LEGACY_ACCOUNT_KEYS.forEach(key => window.localStorage.removeItem(key))
}

function storeAccount(account: Account) {
  const value = JSON.stringify(account)
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, value)
  LEGACY_ACCOUNT_KEYS.forEach(key => window.localStorage.setItem(key, value))
}

async function archiveEmail(username: string) {
  const bytes = new TextEncoder().encode(username)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 32)}@vtm.local`
}

function asAccount(value: unknown): Account | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Account>
  if (typeof candidate.id !== 'string' || typeof candidate.username !== 'string') {
    return null
  }
  return { id: candidate.id, username: candidate.username }
}

async function getAccountProfile(authUserId: string, username?: string) {
  const client = createAccountClient()
  const byAuth = await client
    .from('users')
    .select('id, username')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const account = asAccount(byAuth.data)
  if (account) return account
  if (!username) return null

  const byUsername = await client
    .from('users')
    .select('id, username')
    .eq('username', username)
    .maybeSingle()
  return asAccount(byUsername.data)
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const rememberAccount = useCallback((nextAccount: Account | null) => {
    setAccount(nextAccount)
    if (nextAccount) storeAccount(nextAccount)
    else clearStoredAccount()
  }, [])

  useEffect(() => {
    let cancelled = false
    const client = createAccountClient()

    const restore = async () => {
      try {
        const { data, error } = await client.auth.getUser()
        if (cancelled) return
        if (error?.name !== 'AuthSessionMissingError' && error) throw error
        if (!data.user) {
          rememberAccount(null)
          return
        }

        const profile = await getAccountProfile(data.user.id)
        if (cancelled) return
        if (!profile) {
          await client.auth.signOut({ scope: 'local' })
          rememberAccount(null)
          return
        }
        rememberAccount(profile)
      } catch (error) {
        console.error('Не удалось восстановить общую сессию TableTopGames:', error)
        if (!cancelled) rememberAccount(null)
      } finally {
        if (!cancelled) setIsReady(true)
      }
    }

    void restore()
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        rememberAccount(null)
        setIsReady(true)
        return
      }
      if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return
      void getAccountProfile(session.user.id).then(profile => {
        if (!cancelled && profile) rememberAccount(profile)
      })
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [rememberAccount])

  const authenticate = useCallback(async (
    mode: AccountAuthMode,
    usernameValue: string,
    passwordValue: string,
  ) => {
    const username = usernameValue.trim()
    const password = passwordValue.trim()
    if (username.length < 3) throw new Error('Имя пользователя — минимум 3 символа.')
    if (password.length < 6) throw new Error('Пароль — минимум 6 символов.')

    setIsBusy(true)
    try {
      const client = createAccountClient()
      const email = await archiveEmail(username)

      if (mode === 'register') {
        const { data, error } = await client
          .rpc('register_archive_user', {
            p_username: username,
            p_password: password,
          })
          .single()
        if (error || !data) {
          throw new Error(error?.code === '23505'
            ? 'Такой пользователь уже существует.'
            : 'Не удалось создать аккаунт.')
        }

        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          throw new Error('Аккаунт создан, но вход не выполнен. Попробуйте войти.')
        }

        const profile = asAccount(data)
        if (!profile) throw new Error('Не удалось загрузить профиль аккаунта.')
        rememberAccount(profile)
        return
      }

      let { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        const { data: migrated } = await client
          .rpc('migrate_legacy_auth', {
            p_username: username,
            p_password: password,
          })
          .single()
        if (migrated) {
          ;({ error: signInError } = await client.auth.signInWithPassword({
            email,
            password,
          }))
        }
      }

      if (signInError) throw new Error('Неверный логин или пароль.')

      const { data: authData } = await client.auth.getUser()
      const profile = authData.user
        ? await getAccountProfile(authData.user.id, username)
        : null
      if (!profile) {
        await client.auth.signOut({ scope: 'local' })
        throw new Error('Не удалось загрузить профиль аккаунта.')
      }
      rememberAccount(profile)
    } finally {
      setIsBusy(false)
      setIsReady(true)
    }
  }, [rememberAccount])

  const signOut = useCallback(async () => {
    setIsBusy(true)
    try {
      await createAccountClient().auth.signOut({ scope: 'local' })
      rememberAccount(null)
    } finally {
      setIsBusy(false)
    }
  }, [rememberAccount])

  const value = useMemo<AccountContextValue>(() => ({
    account,
    isReady,
    isBusy,
    authenticate,
    signOut,
  }), [account, authenticate, isBusy, isReady, signOut])

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const value = useContext(AccountContext)
  if (!value) throw new Error('useAccount must be used inside AccountProvider')
  return value
}
