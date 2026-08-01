'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { TableRole } from '../types'

type TableRoleGateProps = {
  open: boolean
  onChooseMaster: () => void
  onChoosePlayer: () => void
}

export function TableRoleGate({
  open,
  onChooseMaster,
  onChoosePlayer,
}: TableRoleGateProps) {
  const { t } = useLang()

  if (!open) return null

  return (
    <div className="role-gate" role="dialog" aria-modal="true" aria-label={t('Выбор роли')}>
      <section>
        <span>{t('Вход на стол')}</span>
        <h2>{t('Кто ты в этой сцене?')}</h2>
        <div>
          <button type="button" onClick={onChooseMaster}>
            {t('Мастер')}
          </button>
          <button type="button" onClick={onChoosePlayer}>
            {t('Игрок')}
          </button>
        </div>
      </section>
    </div>
  )
}

type MasterRoleTopbarProps = {
  tableRole: TableRole | null
  isMaster: boolean
  onResetTableRole: () => void
}

export function MasterRoleTopbar({
  tableRole,
  isMaster,
  onResetTableRole,
}: MasterRoleTopbarProps) {
  const { t } = useLang()

  return (
    <button type="button" className="role-pill" onClick={onResetTableRole}>
      {isMaster ? t('Мастер') : tableRole === 'player' ? t('Игрок') : t('Выбрать роль')}
    </button>
  )
}
