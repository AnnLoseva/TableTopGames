'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import {
  getDocumentEmbedUrl,
  getEmbeddableVideoUrl,
  getFileLayerMeta,
} from '../utils/media-utils'
import type { TableLayer } from '../types'

export type MediaPreviewModalProps = {
  layer: TableLayer
  onClose: () => void
}

export default function MediaPreviewModal({ layer, onClose }: MediaPreviewModalProps) {
  const { t } = useLang()

  return (
    <div
      className="media-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('Предпросмотр медиа')}
      onMouseDown={onClose}
    >
      <section className="media-preview-modal" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <span>{layer.ownerRole === 'master' ? t('Мастер') : t('Игрок')}</span>
            <strong>{layer.name}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Закрыть предпросмотр')}>×</button>
        </header>
        <div className="media-preview-body">
          {layer.layerType === 'image' ? (
            <img src={layer.imageData} alt={layer.name} />
          ) : layer.layerType === 'video' ? (
            getEmbeddableVideoUrl(layer.imageData) ? (
              <iframe
                src={getEmbeddableVideoUrl(layer.imageData)}
                title={layer.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video src={layer.imageData} controls playsInline />
            )
          ) : layer.layerType === 'text' ? (
            <article className="preview-text-material" dangerouslySetInnerHTML={{ __html: layer.imageData }} />
          ) : layer.layerType === 'file' ? (() => {
            const meta = getFileLayerMeta(layer.imageData, layer.name)
            const embedUrl = getDocumentEmbedUrl(meta)
            return embedUrl ? (
              <iframe src={embedUrl} title={layer.name} />
            ) : (
              <article className="preview-file-card">
                <strong>{layer.name}</strong>
                <span>{meta.type}</span>
                <a href={meta.url} target="_blank" rel="noreferrer">{t('Открыть файл')}</a>
              </article>
            )
          })() : null}
        </div>
      </section>
    </div>
  )
}