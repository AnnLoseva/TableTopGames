'use client'

import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react'
import styles from '../Pathfinder2SheetPage.module.css'

type ChoiceGalleryDialogProps<Item extends { id: string; name: string }> = {
  open: boolean
  title: string
  description: string
  items: Item[]
  selectedIds: string[]
  previewId: string
  readOnly?: boolean
  controls: ReactNode
  emptyMessage: string
  renderCard: (
    item: Item,
    state: { selected: boolean; previewed: boolean },
  ) => ReactNode
  renderDetails: (item: Item) => ReactNode
  onPreview: (id: string) => void
  onConfirm: (id: string) => void
  onClose: () => void
}

export default function ChoiceGalleryDialog<
  Item extends { id: string; name: string },
>({
  open,
  title,
  description,
  items,
  selectedIds,
  previewId,
  readOnly = false,
  controls,
  emptyMessage,
  renderCard,
  renderDetails,
  onPreview,
  onConfirm,
  onClose,
}: ChoiceGalleryDialogProps<Item>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const headingId = useId()
  const descriptionId = useId()
  const previewedItem = items.find(item => item.id === previewId)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      const previousOverflow = document.body.style.overflow
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        onCloseRef.current()
      }
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeyDown, true)
      requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus()
      })
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true)
        document.body.style.overflow = previousOverflow
        if (dialog.open) dialog.close()
      }
    }

    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.galleryDialog}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.galleryShell}>
        <header className={styles.galleryHeader}>
          <div>
            <span className={styles.panelEyebrow}>
              Каталог Pathfinder 2
            </span>
            <h2 id={headingId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button
            type="button"
            className={styles.galleryClose}
            data-dialog-initial-focus
            aria-label="Закрыть каталог"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.galleryControls}>{controls}</div>

        <div className={styles.galleryBody}>
          <section className={styles.galleryList} aria-label="Варианты выбора">
            <div className={styles.galleryCount}>
              Найдено: <strong>{items.length}</strong>
            </div>
            {items.length > 0 ? (
              <div className={styles.galleryGrid}>
                {items.map(item => {
                  const selected = selectedIds.includes(item.id)
                  const previewed = item.id === previewId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-choice-id={item.id}
                      className={[
                        styles.galleryCard,
                        selected ? styles.galleryCardSelected : '',
                        previewed ? styles.galleryCardPreviewed : '',
                      ].filter(Boolean).join(' ')}
                      aria-pressed={previewed}
                      onClick={() => onPreview(item.id)}
                    >
                      {renderCard(item, { selected, previewed })}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className={styles.galleryEmpty}>
                <strong>Ничего не найдено</strong>
                <p>{emptyMessage}</p>
              </div>
            )}
          </section>

          <aside className={styles.galleryPreview} aria-live="polite">
            {previewedItem ? (
              <>
                {renderDetails(previewedItem)}
                <div className={styles.galleryFooter}>
                  {readOnly ? (
                    <button
                      type="button"
                      className={styles.nextButton}
                      onClick={onClose}
                    >
                      Закрыть
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.nextButton}
                      onClick={() => onConfirm(previewedItem.id)}
                    >
                      {selectedIds.includes(previewedItem.id)
                        ? 'Оставить выбранным'
                        : 'Подтвердить выбор'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.galleryPreviewEmpty}>
                <span aria-hidden="true">✦</span>
                <strong>Выберите карточку</strong>
                <p>
                  Подробности появятся здесь. Предпросмотр не меняет лист до
                  подтверждения.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </dialog>
  )
}
