import type { Dispatch, SetStateAction } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type TableLeftPanelProps = {
  isMaster: boolean
  leftPanelOpen: boolean
  setLeftPanelOpen: Dispatch<SetStateAction<boolean>>
  children: React.ReactNode
}

export default function TableLeftPanel({
  isMaster,
  leftPanelOpen,
  setLeftPanelOpen,
  children,
}: TableLeftPanelProps) {
  const { t } = useLang()
  return (
    <>
      {isMaster ? (
        <button
          type="button"
          className="column-edge-toggle master-toggle"
          onClick={() => setLeftPanelOpen(prev => !prev)}
          aria-label={leftPanelOpen ? t('Скрыть сцены') : t('Показать сцены')}
          title={leftPanelOpen ? t('Скрыть сцены') : t('Показать сцены')}
        >
          <span />
          <span />
          <span />
        </button>
      ) : null}
      {children}
    </>
  )
}
