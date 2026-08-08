'use client'

import { useEffect, useRef, useState } from 'react'

export type UseUnreadFeedOptions<T> = {
  /** Лента целиком: история + новые записи. */
  items: T[]
  /** Стабильный идентификатор записи. */
  getId: (item: T) => string
  /** Первая загрузка завершена — до неё непрочитанных не бывает. */
  ready: boolean
  /** Панель с лентой сейчас видна: всё считается прочитанным. */
  active: boolean
  /** Свои записи не подсвечиваем. */
  isOwn?: (item: T) => boolean
}

/**
 * Счётчик непрочитанного для панели стола (чат, броски).
 * История при первом появлении считается прочитанной, свои записи не считаются,
 * и всё сбрасывается, как только панель открыта.
 */
export function useUnreadFeed<T>({ items, getId, ready, active, isOwn }: UseUnreadFeedOptions<T>) {
  const [unreadCount, setUnreadCount] = useState(0)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  // Колбэки пересоздаются на каждый рендер — держим их в ref, чтобы не дёргать эффект
  const getIdRef = useRef(getId)
  const isOwnRef = useRef(isOwn)
  getIdRef.current = getId
  isOwnRef.current = isOwn

  useEffect(() => {
    if (!ready) return

    const markAllSeen = () => {
      seenIdsRef.current = new Set(items.map(item => getIdRef.current(item)))
      setUnreadCount(0)
    }

    if (!initializedRef.current) {
      initializedRef.current = true
      markAllSeen()
      return
    }

    if (active) {
      markAllSeen()
      return
    }

    let count = 0
    items.forEach(item => {
      const id = getIdRef.current(item)
      if (seenIdsRef.current.has(id)) return
      if (isOwnRef.current?.(item)) {
        seenIdsRef.current.add(id)
        return
      }
      count += 1
    })
    setUnreadCount(count)
  }, [items, ready, active])

  return unreadCount
}
