'use client'

import type { FormEvent } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { TableRole } from '../types'

type MasterPasswordGateProps = {
  open: boolean
  masterPasswordDraft: string
  onMasterPasswordDraftChange: (value: string) => void
  onEnterAsMaster: (event: FormEvent<HTMLFormElement>) => void
  onChoosePlayer: () => void
}

export function MasterPasswordGate({
  open,
  masterPasswordDraft,
  onMasterPasswordDraftChange,
  onEnterAsMaster,
  onChoosePlayer,
}: MasterPasswordGateProps) {
  const { t } = useLang()

  if (!open) return null

  return (
    <div className="role-gate" role="dialog" aria-modal="true" aria-label={t('Выбор роли')}>
      <section>
        <span>{t('Вход на стол')}</span>
        <h2>{t('Кто ты в этой сцене?')}</h2>
        <form className="master-login-form" onSubmit={onEnterAsMaster}>
          <input
            value={masterPasswordDraft}
            onChange={event => onMasterPasswordDraftChange(event.target.value)}
            placeholder={t('Пароль мастера')}
            type="password"
          />
          <button type="submit">{t('Мастер')}</button>
        </form>
        <div>
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
  masterPasswordEdit: string
  onMasterPasswordEditChange: (value: string) => void
  onResetTableRole: () => void
  onSaveMasterPassword: () => void
}

export function MasterRoleTopbar({
  tableRole,
  isMaster,
  masterPasswordEdit,
  onMasterPasswordEditChange,
  onResetTableRole,
  onSaveMasterPassword,
}: MasterRoleTopbarProps) {
  const { t } = useLang()

  return (
    <>
      <button type="button" className="role-pill" onClick={onResetTableRole}>
        {isMaster ? t('Мастер') : tableRole === 'player' ? t('Игрок') : t('Выбрать роль')}
      </button>
      {isMaster ? (
        <label className="master-password-control">
          <span>{t('Пароль мастера')}</span>
          <input
            value={masterPasswordEdit}
            onChange={event => onMasterPasswordEditChange(event.target.value)}
            aria-label={t('Пароль мастера')}
          />
          <button type="button" onClick={onSaveMasterPassword}>{t('Сменить')}</button>
        </label>
      ) : null}
    </>
  )
}