'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { dictionary } from './dictionary'

export type Lang = 'ru' | 'en'

const STORAGE_KEY = 'vtm-lang'

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Looks up `ru` in the dictionary when lang === 'en'; otherwise returns it unchanged. */
  t: (ru: string) => string
  /** Same as t(), but substitutes {placeholder} tokens after translation. */
  tf: (ru: string, vars: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ru') setLangState(stored)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (ru: string) => {
      if (lang !== 'en') return ru
      return dictionary[ru.trim()] ?? ru
    },
    [lang],
  )

  const tf = useCallback(
    (ru: string, vars: Record<string, string | number>) => {
      const translated = t(ru)
      return Object.entries(vars).reduce(
        (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
        translated,
      )
    },
    [t],
  )

  const value = useMemo(() => ({ lang, setLang, t, tf }), [lang, setLang, t, tf])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLang() must be used within a <LanguageProvider>')
  }
  return ctx
}
