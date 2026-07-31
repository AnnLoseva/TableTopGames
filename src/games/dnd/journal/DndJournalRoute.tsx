'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from '@/platform/account/AccountProvider'
import { createAccountClient } from '@/platform/account/supabase'
import { createJournalPage, listJournalPages, softDeleteJournalPage, updateJournalPage } from './api/journal-api'
import styles from './components/DndJournalRoute.module.css'
import JournalEditor from './components/JournalEditor'
import JournalSidebar from './components/JournalSidebar'
import { DND_JOURNAL_OWNER_AUTH_USER_ID, DND_JOURNAL_PAGES_TABLE } from './constants'
import { mapPageRow } from './mappers'
import type { DndJournalPage, DndJournalPageEditablePatch, DndJournalPageRow } from './types'

function mergeRealtimeRow(pages: DndJournalPage[], row: DndJournalPageRow): DndJournalPage[] {
  if (row.deleted_at) return pages.filter(page => page.id !== row.id)
  const mapped = mapPageRow(row)
  const exists = pages.some(page => page.id === row.id)
  return exists ? pages.map(page => (page.id === row.id ? mapped : page)) : [mapped, ...pages]
}

export default function DndJournalRoute() {
  const { account, isReady } = useAccount()
  const client = useMemo(() => createAccountClient(), [])
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [pages, setPages] = useState<DndJournalPage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!account) {
      setAuthUserId(null)
      return
    }
    let cancelled = false
    client.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthUserId(data.user?.id ?? null)
    })
    return () => { cancelled = true }
  }, [account, client])

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    listJournalPages(client)
      .then(loaded => {
        if (cancelled) return
        setPages(loaded)
        setSelectedId(prev => prev ?? loaded[0]?.id ?? null)
      })
      .catch(error => {
        if (cancelled) return
        console.error('Не удалось загрузить журнал:', error)
        setLoadError('Не удалось загрузить журнал. Попробуйте обновить страницу.')
      })
    return () => { cancelled = true }
  }, [client])

  const isEditor = authUserId === DND_JOURNAL_OWNER_AUTH_USER_ID

  useEffect(() => {
    const channel = client
      .channel(`dnd-journal:${DND_JOURNAL_OWNER_AUTH_USER_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: DND_JOURNAL_PAGES_TABLE,
          filter: `user_id=eq.${DND_JOURNAL_OWNER_AUTH_USER_ID}`,
        },
        payload => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string } | null)?.id
            if (oldId) setPages(prev => prev.filter(page => page.id !== oldId))
            return
          }
          setPages(prev => mergeRealtimeRow(prev, payload.new as DndJournalPageRow))
        },
      )
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [client])

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const created = await createJournalPage(client, { title: '', type: 'note' })
      setPages(prev => [created, ...prev])
      setSelectedId(created.id)
    } catch (error) {
      console.error('Не удалось создать страницу журнала:', error)
      setLoadError('Не удалось создать страницу.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async (
    id: string,
    patch: DndJournalPageEditablePatch,
    baselineBodyMarkdown?: string,
  ): Promise<DndJournalPage> => {
    const updated = await updateJournalPage(client, id, patch, { baselineBodyMarkdown })
    setPages(prev => prev.map(page => (page.id === id ? updated : page)))
    return updated
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить страницу журнала? Это можно отменить только через приложение.')) return
    try {
      await softDeleteJournalPage(client, id)
      setPages(prev => prev.filter(page => page.id !== id))
      setSelectedId(prev => (prev === id ? null : prev))
    } catch (error) {
      console.error('Не удалось удалить страницу журнала:', error)
      setLoadError('Не удалось удалить страницу.')
    }
  }

  const selectedPage = pages.find(page => page.id === selectedId) ?? null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/" className={styles.backLink}>← TableTopGames</Link>
          <h1 className={styles.title}>Журнал похода</h1>
        </div>
        <span className={styles.account}>
          {isEditor ? 'Режим редактирования' : !isReady ? 'Проверяю аккаунт…' : account ? `Аккаунт: ${account.username}` : 'Гостевой режим'}
        </span>
      </header>

      <div className={styles.body}>
        <JournalSidebar
          pages={pages}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          isCreating={isCreating}
          isEditor={isEditor}
        />
        <main className={styles.main}>
          {loadError && <p className={styles.saveStatus}>{loadError}</p>}
          {selectedPage ? (
            <JournalEditor
              key={selectedPage.id}
              client={client}
              page={selectedPage}
              onSave={handleSave}
              onDelete={handleDelete}
              isEditor={isEditor}
            />
          ) : (
            <div className={styles.placeholder}>
              <p>{pages.length === 0 ? 'В журнале пока нет страниц.' : 'Выберите страницу слева.'}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
