'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type MediaUploadDialogProps = {
  open: boolean
  isUploading: boolean
  canUploadBackground: boolean
  onChooseFiles: () => void
  onChooseFolder: () => void
  onChooseBackground: () => void
  onClose: () => void
}

export default function MediaUploadDialog({
  open,
  isUploading,
  canUploadBackground,
  onChooseFiles,
  onChooseFolder,
  onChooseBackground,
  onClose,
}: MediaUploadDialogProps) {
  const { t } = useLang()
  if (!open) return null

  const choose = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div className="media-upload-dialog" role="dialog" aria-modal="true" aria-label={t('Загрузить медиа')} onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <span>{t('Медиа')}</span>
            <strong>{t('Что загрузить?')}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Закрыть')}>×</button>
        </header>
        <div className="media-upload-options">
          <button type="button" disabled={isUploading} onClick={() => choose(onChooseFiles)}>
            <strong>{t('Файлы')}</strong>
            <span>{t('Картинки, видео и документы')}</span>
          </button>
          <button type="button" disabled={isUploading} onClick={() => choose(onChooseFolder)}>
            <strong>{t('Папка файлов')}</strong>
            <span>{t('Структура вложенных папок сохранится')}</span>
          </button>
          {canUploadBackground ? (
            <button type="button" disabled={isUploading} onClick={() => choose(onChooseBackground)}>
              <strong>{t('Фон')}</strong>
              <span>{t('Картинка станет фоном активной сцены')}</span>
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
