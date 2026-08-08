import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { RightRailTab } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type TableRightPanelProps = {
  isMaster: boolean
  rightPanelOpen: boolean
  rightRailTab: RightRailTab
  unreadChatCount: number
  unreadRollCount: number
  voiceSpeakingCount: number
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  children: ReactNode
}

export default function TableRightPanel({
  isMaster,
  rightPanelOpen,
  rightRailTab,
  unreadChatCount,
  unreadRollCount,
  voiceSpeakingCount,
  setRightPanelOpen,
  setRightRailTab,
  children,
}: TableRightPanelProps) {
  const { t, tf } = useLang()
  const totalUnread = unreadChatCount + unreadRollCount

  // В узком рейле счётчик съедает подпись — показываем точку, число живёт на под-вкладке «Текст»
  const renderUnread = (count: number) => (count > 0 ? (
    <i className="tab-unread-dot" role="img" aria-label={tf('{count} непрочитанных', { count })} />
  ) : null)

  return (
    <>
      <button
        type="button"
        className={`column-edge-toggle right-toggle ${!rightPanelOpen && totalUnread > 0 ? 'has-unread' : ''}`}
        onClick={() => setRightPanelOpen(prev => !prev)}
        aria-label={rightPanelOpen ? t('Скрыть правую панель') : t('Показать правую панель')}
        title={rightPanelOpen ? t('Скрыть правую панель') : t('Показать правую панель')}
      >
        <span />
        <span />
        <span />
        {!rightPanelOpen && totalUnread > 0 ? <i className="edge-unread" aria-hidden="true" /> : null}
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
            className={`${rightRailTab === 'rolls' ? 'active' : ''} ${unreadRollCount > 0 ? 'has-unread' : ''}`}
            onClick={() => setRightRailTab('rolls')}
          >
            <span className="tab-label">{t('Броски')}</span>
            {renderUnread(unreadRollCount)}
          </button>
          <button
            type="button"
            className={`${rightRailTab === 'chat' ? 'active' : ''} ${unreadChatCount > 0 ? 'has-unread' : ''} ${voiceSpeakingCount > 0 ? 'has-speaking' : ''}`}
            onClick={() => setRightRailTab('chat')}
          >
            <span className="tab-label">{t('Чат')}</span>
            {voiceSpeakingCount > 0 ? (
              <i className="tab-speaking" aria-label={t('Кто-то говорит в голосовом чате')} role="img" />
            ) : null}
            {renderUnread(unreadChatCount)}
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
