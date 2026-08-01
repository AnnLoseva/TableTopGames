import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { RightRailTab } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type TableRightPanelProps = {
  isMaster: boolean
  rightPanelOpen: boolean
  rightRailTab: RightRailTab
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  children: ReactNode
}

export default function TableRightPanel({
  isMaster,
  rightPanelOpen,
  rightRailTab,
  setRightPanelOpen,
  setRightRailTab,
  children,
}: TableRightPanelProps) {
  const { t } = useLang()
  return (
    <>
      <button
        type="button"
        className="column-edge-toggle right-toggle"
        onClick={() => setRightPanelOpen(prev => !prev)}
        aria-label={rightPanelOpen ? t('Скрыть правую панель') : t('Показать правую панель')}
        title={rightPanelOpen ? t('Скрыть правую панель') : t('Показать правую панель')}
      >
        <span />
        <span />
        <span />
      </button>
      {rightPanelOpen ? <aside className="right-rail">
        <nav className="right-tabs" aria-label={t('Панели стола')}>
          {!isMaster ? (
            <button
              type="button"
              className={rightRailTab === 'media' ? 'active' : ''}
              onClick={() => setRightRailTab('media')}
            >
              {t('Мои медиа')}
            </button>
          ) : null}
          {!isMaster ? (
            <button
              type="button"
              className={rightRailTab === 'characters' ? 'active' : ''}
              onClick={() => setRightRailTab('characters')}
            >
              {t('Мои персонажи')}
            </button>
          ) : null}
          <button
            type="button"
            className={rightRailTab === 'rolls' ? 'active' : ''}
            onClick={() => setRightRailTab('rolls')}
          >
            {t('Броски')}
          </button>
          <button
            type="button"
            className={rightRailTab === 'chat' ? 'active' : ''}
            onClick={() => setRightRailTab('chat')}
          >
            {t('Чат')}
          </button>
          <button
            type="button"
            className={rightRailTab === 'master' ? 'active' : ''}
            onClick={() => setRightRailTab('master')}
          >
            {t('Мастер')}
          </button>
        </nav>
        {children}
      </aside> : null}
    </>
  )
}
