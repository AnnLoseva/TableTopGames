'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import {
  getRoomFromLocation,
  rememberRoom,
  rememberTableRole,
  verifyMasterPassword,
} from '@/games/vampires/modules/table/utils/room-session'
import { bootstrapMasterConsoleForRoom } from './bootstrap'
import { getMasterConsoleAccess } from './api'
import MasterConsoleShell from './MasterConsoleShell'
import type { MasterConsoleRouteState } from './types'

const VALID_ROOM = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]{1,48}$/

export default function MasterConsoleRoute() {
  const [state, setState] = useState<MasterConsoleRouteState>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    let cancelled = false
    const roomParam = new URLSearchParams(window.location.search).get('room')?.trim() || ''
    if (!roomParam || !VALID_ROOM.test(roomParam)) {
      setState({
        status: 'invalid-room',
        message: 'Укажите корректную комнату: /master?room=campaign-666',
      })
      return
    }

    const room = getRoomFromLocation()
    rememberRoom(room)
    rememberTableRole('master')

    const boot = async () => {
      try {
        bootstrapMasterConsoleForRoom(room)
        const access = await getMasterConsoleAccess(room)
        if (cancelled) return
        if (access.status === 'signed-out') {
          setState({ status: 'auth-required', room })
          return
        }
        if (access.status === 'forbidden') {
          setState({ status: 'access-denied', room })
          return
        }
        setState({ status: 'locked', room, denied: false })
      } catch (error) {
        console.error('Master console access check failed:', error)
        if (!cancelled) {
          setState({
            status: 'access-error',
            room,
            message: 'Supabase не подтвердил доступ. Проверьте соединение и повторите попытку.',
          })
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'ready') return
    const client = createClient()
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setPassword('')
        setState({ status: 'auth-required', room: state.room })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [state])

  const enter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (state.status !== 'locked' || unlocking) return
    if (!verifyMasterPassword(password)) {
      setState({ ...state, denied: true })
      return
    }

    setUnlocking(true)
    try {
      const access = await getMasterConsoleAccess(state.room)
      if (access.status === 'signed-out') {
        setPassword('')
        setState({ status: 'auth-required', room: state.room })
        return
      }
      if (access.status === 'forbidden') {
        setPassword('')
        setState({ status: 'access-denied', room: state.room })
        return
      }
      setPassword('')
      setState({ status: 'ready', room: state.room })
    } catch (error) {
      console.error('Master console unlock check failed:', error)
      setState({
        status: 'access-error',
        room: state.room,
        message: 'Не удалось повторно подтвердить доступ мастера.',
      })
    } finally {
      setUnlocking(false)
    }
  }

  if (state.status === 'loading') {
    return <MasterConsoleState title="Загрузка пульта" message="Подготавливаем комнату и VTM5 runtime…" />
  }

  if (state.status === 'invalid-room') {
    return <MasterConsoleState title="Комната не указана" message={state.message} tone="error" />
  }

  if (state.status === 'auth-required') {
    return (
      <MasterConsoleState
        title="Нужен вход в архив"
        message={`Для пульта комнаты ${state.room} требуется действующая Supabase Auth-сессия.`}
        tone="error"
        action={<Link href="/">Войти на главной</Link>}
      />
    )
  }

  if (state.status === 'access-denied') {
    return (
      <MasterConsoleState
        title="Нет доступа мастера"
        message={`Текущий аккаунт не назначен мастером хроники ${state.room}.`}
        tone="error"
        action={<Link href="/">Сменить аккаунт</Link>}
      />
    )
  }

  if (state.status === 'access-error') {
    return (
      <MasterConsoleState
        title="Не удалось проверить доступ"
        message={state.message}
        tone="error"
        action={<button type="button" onClick={() => window.location.reload()}>Повторить</button>}
      />
    )
  }

  if (state.status === 'locked') {
    return (
      <div className="master-console-access vtm-theme">
        <form onSubmit={enter} aria-label="Доступ к пульту рассказчика">
          <span>Пульт рассказчика · V5</span>
          <h1>Подтвердите доступ мастера</h1>
          <p>Комната: <strong>{state.room}</strong></p>
          <label>
            <span>Пароль мастера</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              aria-invalid={state.denied}
            />
          </label>
          {state.denied ? <p className="master-console-error" role="alert">Доступ запрещён: пароль не подошёл.</p> : null}
          <button type="submit" disabled={unlocking}>{unlocking ? 'Проверяем доступ…' : 'Открыть пульт'}</button>
        </form>
      </div>
    )
  }

  return <MasterConsoleShell room={state.room} onLock={() => setState({ status: 'locked', room: state.room, denied: false })} />
}

function MasterConsoleState({
  title,
  message,
  tone = 'neutral',
  action,
}: {
  title: string
  message: string
  tone?: 'neutral' | 'error'
  action?: ReactNode
}) {
  return (
    <main className="master-console-state vtm-theme" data-tone={tone}>
      <section>
        <span>Пульт рассказчика · V5</span>
        <h1>{title}</h1>
        <p>{message}</p>
        {action ? <div className="master-console-state-action">{action}</div> : null}
      </section>
    </main>
  )
}
