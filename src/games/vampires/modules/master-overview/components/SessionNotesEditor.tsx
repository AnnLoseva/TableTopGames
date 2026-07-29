'use client'

import { useEffect, useRef } from 'react'

type SessionNotesEditorProps = {
  html: string
  onChange: (html: string) => void
  onCommand?: (command: string) => void
}

/** ContentEditable that does not rewrite DOM on every keystroke (preserves caret). */
export default function SessionNotesEditor({ html, onChange }: SessionNotesEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef(html)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) return
    if (el.innerHTML !== html) {
      el.innerHTML = html || ''
      lastEmitted.current = html
    }
  }, [html])

  return (
    <div
      ref={ref}
      className="mo-note-editor"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Заметки ночи… autosave, private by default"
      onInput={() => {
        const next = ref.current?.innerHTML || ''
        if (next === lastEmitted.current) return
        lastEmitted.current = next
        onChange(next)
      }}
    />
  )
}
