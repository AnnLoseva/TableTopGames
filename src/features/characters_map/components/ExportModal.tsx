'use client'

import { useRef, useState } from 'react'
import { t, type MapLanguage } from '../i18n'
import modalStyles from './Modal.module.css'
import styles from './ExportModal.module.css'

type Props = {
  text: string
  language: MapLanguage
  onClose: () => void
}

type CopyStatus = 'idle' | 'copied' | 'failed'

export default function ExportModal({ text, language, onClose }: Props) {
  const s = t(language).exportModal
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCopy = async () => {
    let succeeded = false
    try {
      await navigator.clipboard.writeText(text)
      succeeded = true
    } catch {
      textareaRef.current?.select()
      succeeded = document.execCommand('copy')
    }
    setCopyStatus(succeeded ? 'copied' : 'failed')
    window.setTimeout(() => setCopyStatus('idle'), 2500)
  }

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'characters-map.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={`${modalStyles.modal} ${styles.modal}`} onClick={event => event.stopPropagation()}>
        <h2 className={modalStyles.title}>{s.title}</h2>
        <p className={styles.hint}>{s.hint}</p>
        <textarea ref={textareaRef} className={styles.textarea} readOnly value={text} onFocus={event => event.target.select()} />
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primaryButton} onClick={handleCopy}>
            {s.copyButton}
          </button>
          <button type="button" className={modalStyles.secondaryButton} onClick={handleDownload}>
            {s.downloadButton}
          </button>
          <button type="button" className={modalStyles.secondaryButton} onClick={onClose}>
            {s.closeButton}
          </button>
        </div>
        {copyStatus === 'copied' && <p className={styles.copiedNote}>{s.copiedNote}</p>}
        {copyStatus === 'failed' && (
          <p className={styles.copyFailedNote}>{s.copyFailedNote}</p>
        )}
      </div>
    </div>
  )
}
