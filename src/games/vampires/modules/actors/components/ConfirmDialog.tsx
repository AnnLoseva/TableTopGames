'use client'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="actors-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="actors-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actors-confirm-title"
        onClick={event => event.stopPropagation()}
      >
        <h3 id="actors-confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="actors-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Отмена</button>
          <button
            type="button"
            data-danger={danger ? 'true' : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
