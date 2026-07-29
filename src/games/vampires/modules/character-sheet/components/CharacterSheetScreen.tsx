'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import {
  buildSheetIframeSrc,
  buildTableHref,
  clearCreationDraft,
  pushNewCharacterUrl,
  readCharacterSheetParams,
  rememberSheetNavigation,
  replaceUrlAfterCharacterSaved,
  subscribeCharacterSaved,
  type CharacterSheetParams,
} from '@/games/vampires/modules/character-sheet'

export default function CharacterSheetPage() {
  const { t } = useLang()
  const [params, setParams] = useState<CharacterSheetParams>({
    room: 'campaign-666',
    role: 'player',
    characterId: '',
    isNewCharacter: false,
  })
  const [newCharacterSession, setNewCharacterSession] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const next = readCharacterSheetParams(window.location.search, window.localStorage)
    setParams(next)
    window.localStorage.setItem('vtm-table-room', next.room)
    setIsReady(true)
  }, [])

  useEffect(() => {
    return subscribeCharacterSaved(characterId => {
      setParams(prev => ({ ...prev, characterId, isNewCharacter: false }))
      replaceUrlAfterCharacterSaved(characterId)
    })
  }, [])

  const tableHref = useMemo(() => buildTableHref(params.room, params.role), [params.room, params.role])
  const iframeSrc = useMemo(() => buildSheetIframeSrc(params), [params])

  const startNewCharacter = () => {
    clearCreationDraft()
    setParams(prev => ({ ...prev, characterId: '', isNewCharacter: true }))
    setNewCharacterSession(current => current + 1)
    pushNewCharacterUrl(params.room, params.role)
  }

  return (
    <>
      <style jsx global>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100vh !important;
          height: 100dvh !important;
          width: 100vw !important;
          overflow: hidden !important;
          background: #0a0a0a !important;
        }

        iframe {
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #111;
        }
        ::-webkit-scrollbar-thumb {
          background: #991b1b;
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ff3131;
        }
      `}</style>

      <main className="sheet-page-shell">
        <nav className="sheet-nav-links" aria-label={t('Навигация листа персонажа')}>
          <a href="/vampires" title={t('На главную')}>{t('На главную')}</a>
          <button type="button" onClick={startNewCharacter}>
            {t('Создать нового персонажа')}
          </button>
          <a
            href={tableHref}
            onClick={() => rememberSheetNavigation(params.room, params.role, window.localStorage)}
            title={t('В игровую комнату')}
          >
            {t('В игровую комнату')}
          </a>
        </nav>

        {isReady ? (
          <iframe
            key={`${params.characterId || 'new'}-${newCharacterSession}`}
            src={iframeSrc}
            className="sheet-iframe"
            title="VTM V5 Character Sheet"
          />
        ) : null}
      </main>

      <style jsx>{`
        .sheet-page-shell {
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
          background: #0a0a0a;
        }

        .sheet-nav-links {
          z-index: 2;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          padding: 12px 18px;
          border-bottom: 1px solid #2d2d2d;
          background: #0a0a0a;
        }

        .sheet-nav-links a,
        .sheet-nav-links button {
          min-width: 92px;
          min-height: 38px;
          max-width: 100%;
          display: inline-grid;
          place-items: center;
          border: 1px solid #773030;
          border-radius: 6px;
          background: rgba(12,12,12,0.92);
          color: #fff;
          font-family: "Courier New", Courier, monospace;
          font-size: 14px;
          line-height: 1.2;
          text-align: center;
          text-decoration: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          cursor: pointer;
        }

        .sheet-nav-links a:hover,
        .sheet-nav-links button:hover {
          background: #2a1111;
          border-color: #ff3131;
        }

        .sheet-iframe {
          width: 100%;
          height: 100%;
          min-height: 0;
          border: none;
          display: block;
          z-index: 1;
        }

        @media (max-width: 640px) {
          .sheet-nav-links {
            justify-content: flex-start;
            padding: 10px;
          }

          .sheet-nav-links a,
          .sheet-nav-links button {
            flex: 1 1 150px;
            min-width: 0;
            min-height: 36px;
            padding: 7px 8px;
            font-size: 12px;
          }
        }
      `}</style>
    </>
  )
}