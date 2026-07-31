'use client'

import { useEffect, useState } from 'react'
import { createAccountClient } from '@/platform/account/supabase'
import { deleteJournalImage, getJournalImageUrl, listJournalImages, uploadJournalImage } from '../api/images-api'
import { DND_JOURNAL_ALLOWED_IMAGE_TYPES, DND_JOURNAL_MAX_IMAGE_BYTES } from '../constants'
import type { DndJournalImage } from '../types'
import styles from './DndJournalRoute.module.css'

type JournalImageGalleryProps = {
  client: ReturnType<typeof createAccountClient>
  pageId: string
  isEditor: boolean
}

export default function JournalImageGallery({ client, pageId, isEditor }: JournalImageGalleryProps) {
  const [images, setImages] = useState<DndJournalImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setImages([])
    listJournalImages(client, pageId)
      .then(loaded => {
        if (!cancelled) setImages(loaded)
      })
      .catch(loadError => {
        if (!cancelled) console.error('Не удалось загрузить изображения журнала:', loadError)
      })
    return () => { cancelled = true }
  }, [client, pageId])

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    setError('')
    if (!DND_JOURNAL_ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Неподдерживаемый формат изображения.')
      return
    }
    if (file.size > DND_JOURNAL_MAX_IMAGE_BYTES) {
      setError('Файл слишком большой (максимум 10 МБ).')
      return
    }
    setIsUploading(true)
    try {
      const image = await uploadJournalImage(client, { pageId, name: file.name, file })
      setImages(prev => [...prev, image])
    } catch (uploadError) {
      console.error('Не удалось загрузить изображение:', uploadError)
      setError('Не удалось загрузить изображение.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (image: DndJournalImage) => {
    if (!window.confirm(`Удалить изображение «${image.name || 'без названия'}»?`)) return
    try {
      await deleteJournalImage(client, image)
      setImages(prev => prev.filter(item => item.id !== image.id))
    } catch (deleteError) {
      console.error('Не удалось удалить изображение:', deleteError)
      setError('Не удалось удалить изображение.')
    }
  }

  if (!isEditor && images.length === 0) return null

  return (
    <div className={styles.images}>
      <div className={styles.imagesHeadRow}>
        <h3>Изображения</h3>
        {error && <span className={styles.saveStatus}>{error}</span>}
      </div>
      <div className={styles.imagesGrid}>
        {images.map(image => (
          <div key={image.id} className={styles.imageTile}>
            <img src={getJournalImageUrl(client, image.storagePath)} alt={image.name} />
            {isEditor && (
              <button
                type="button"
                className={styles.imageRemove}
                onClick={() => handleDelete(image)}
                aria-label={`Удалить ${image.name || 'изображение'}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {isEditor && (
          <label className={styles.uploadLabel}>
            {isUploading ? 'Загрузка…' : '+ Добавить'}
            <input
              type="file"
              accept={DND_JOURNAL_ALLOWED_IMAGE_TYPES.join(',')}
              disabled={isUploading}
              onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void handleUpload(file)
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}
