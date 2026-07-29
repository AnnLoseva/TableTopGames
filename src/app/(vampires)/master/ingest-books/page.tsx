'use client'

// Админ-страница загрузки книг правил в Supabase (book_pages).
// Принимает JSONL: {source, title, lang, page, content} на строку.
// Писать могут только мастера (RLS: is_any_chronicle_master).

import { useCallback, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { normalizeBookContent } from './book-text'

type BookPageRow = {
  source: string
  title: string
  lang: string
  page: number
  content: string
}

const BATCH_SIZE = 50

export default function IngestBooksPage() {
  const [status, setStatus] = useState('Выбери JSONL-файл(ы) с постраничным текстом книги.')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        setStatus('Нет auth-сессии. Зайди на главной под своим логином и вернись.')
        return
      }

      for (const file of Array.from(files)) {
        setStatus(`Читаю ${file.name}...`)
        const text = await file.text()
        const rows: BookPageRow[] = []
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const row = JSON.parse(trimmed) as BookPageRow
            if (row.source && row.page > 0 && row.content) {
              rows.push({ ...row, content: normalizeBookContent(row.content) })
            }
          } catch {
            // пропускаем битые строки
          }
        }
        setTotal(rows.length)
        setProgress(0)
        setStatus(`${file.name}: загружаю ${rows.length} страниц...`)

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          const { error } = await supabase
            .from('book_pages')
            .upsert(batch, { onConflict: 'source,page' })
          if (error) {
            setStatus(`Ошибка на страницах ${batch[0].page}–${batch[batch.length - 1].page}: ${error.message}`)
            return
          }
          setProgress(Math.min(i + BATCH_SIZE, rows.length))
        }
        setStatus(`${file.name}: готово, ${rows.length} страниц загружено.`)
      }
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: 24, fontFamily: 'serif', color: '#e8e0d8' }}>
      <h1 style={{ color: '#8b0000' }}>Загрузка книг правил</h1>
      <p>{status}</p>
      {total > 0 && (
        <p>
          {progress} / {total}
          <span style={{ display: 'block', height: 6, background: '#333', borderRadius: 3, marginTop: 8 }}>
            <span style={{ display: 'block', height: 6, width: `${Math.round((progress / total) * 100)}%`, background: '#8b0000', borderRadius: 3 }} />
          </span>
        </p>
      )}
      <input
        type="file"
        accept=".jsonl,application/jsonl,text/plain"
        multiple
        disabled={busy}
        onChange={event => void handleFiles(event.target.files)}
      />
    </main>
  )
}
