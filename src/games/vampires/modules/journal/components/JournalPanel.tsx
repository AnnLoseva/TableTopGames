'use client'

import { type Dispatch, type SetStateAction, useMemo, useRef } from 'react'
import type { ChatUser, JournalEntry, RightRailTab } from '@/games/vampires/modules/table/types'
import JournalEditor, { type JournalEditorHandle } from './JournalEditor'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

// ─── markdown → HTML (for legacy plain-text entries) ─────────────────────────

function convertInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function markdownToHtml(text: string): string {
  if (!text) return ''
  if (text.trim().startsWith('<')) return text
  const lines = text.split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (!line.trim()) { out.push(''); continue }
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^(#+)/)?.[1] ?? '#').length
      out.push(`<h${level}>${convertInline(line.replace(/^#+\s*/, ''))}</h${level}>`)
    } else if (/^---+$/.test(line.trim())) {
      out.push('<hr>')
    } else {
      out.push(convertInline(line))
    }
  }
  const chunks: string[] = []
  let buf: string[] = []
  for (const l of out) {
    if (l === '') {
      if (buf.length) { chunks.push(`<p>${buf.join('<br>')}</p>`); buf = [] }
    } else if (l.startsWith('<h') || l.startsWith('<hr')) {
      if (buf.length) { chunks.push(`<p>${buf.join('<br>')}</p>`); buf = [] }
      chunks.push(l)
    } else {
      buf.push(l)
    }
  }
  if (buf.length) chunks.push(`<p>${buf.join('<br>')}</p>`)
  return chunks.join('') || `<p>${text}</p>`
}

// ─── props ────────────────────────────────────────────────────────────────────

type JournalPanelProps = {
  rightRailTab: RightRailTab
  journalEntries: JournalEntry[]
  journalSaveStatus: string
  chatUser: ChatUser | null
  journalSearch: string
  filteredJournalEntries: JournalEntry[]
  selectedJournalEntry: JournalEntry | null | undefined
  setJournalSearch: Dispatch<SetStateAction<string>>
  createJournalEntry: () => void
  setSelectedJournalEntryId: Dispatch<SetStateAction<string>>
  updateJournalEntry: (patch: Partial<Pick<JournalEntry, 'title' | 'text'>>) => void
  persistCurrentJournal: () => void
  deleteJournalEntry: () => void
  /** Called by GameTable when player picks "Добавить в дневник" from layer context menu */
  addLayerToJournal?: (imageUrl: string, name: string) => void
}

// ─── component ────────────────────────────────────────────────────────────────

export default function JournalPanel({
  rightRailTab,
  journalEntries,
  journalSaveStatus,
  chatUser,
  journalSearch,
  filteredJournalEntries,
  selectedJournalEntry,
  setJournalSearch,
  createJournalEntry,
  setSelectedJournalEntryId,
  updateJournalEntry,
  persistCurrentJournal,
  deleteJournalEntry,
  addLayerToJournal: _addLayerToJournal,
}: JournalPanelProps) {
  const { t, lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'ru-RU'
  const editorRef = useRef<JournalEditorHandle>(null)

  // Convert legacy markdown to HTML.
  // Depends on BOTH id AND text so external changes (e.g. addLayerToJournal)
  // are picked up immediately without needing to switch entries.
  // JournalEditor's useEffect won't reset the cursor during normal typing
  // because editor.getHTML() === value when the user is the source of the change.
  const editorValue = useMemo(
    () => markdownToHtml(selectedJournalEntry?.text ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedJournalEntry?.id, selectedJournalEntry?.text],
  )

  return (
    <section
      className={`diary-sidebar table-right-panel ${rightRailTab === 'diary' ? '' : 'table-right-panel-hidden'}`}
      aria-label={t('Дневник игрока')}
    >
      <header>
        <div>
          <span>{t('Дневник')}</span>
          <strong>{journalEntries.length}</strong>
        </div>
        <div>
          <span>{t('Статус')}</span>
          <strong>{t(journalSaveStatus)}</strong>
        </div>
      </header>

      {!chatUser ? (
        <p className="panel-empty">{t('Войдите в аккаунт, чтобы вести личный дневник комнаты.')}</p>
      ) : (
        <div className="diary-layout">
          {/* ── Sidebar: search + list ── */}
          <aside className="diary-list">
            <input
              value={journalSearch}
              onChange={e => setJournalSearch(e.target.value)}
              placeholder={t('Поиск')}
            />
            <button type="button" onClick={createJournalEntry}>+ {t('Запись')}</button>
            <div className="diary-entries">
              {filteredJournalEntries.length === 0 ? (
                <p className="panel-empty">{t('Записей не найдено.')}</p>
              ) : filteredJournalEntries.map(entry => (
                <button
                  type="button"
                  className={entry.id === selectedJournalEntry?.id ? 'active' : ''}
                  key={entry.id}
                  onClick={() => setSelectedJournalEntryId(entry.id)}
                >
                  <strong>{entry.title || t('Без названия')}</strong>
                  <span>{new Date(entry.updatedAt).toLocaleString(locale)}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Editor area ── */}
          <section className="diary-editor">
            {selectedJournalEntry ? (
              <>
                <input
                  className="diary-title"
                  value={selectedJournalEntry.title}
                  onChange={e => updateJournalEntry({ title: e.target.value })}
                  placeholder={t('Заголовок')}
                />

                {/* Rich text editor in compact mode */}
                <div className="diary-editor-body">
                  <JournalEditor
                    ref={editorRef}
                    compact
                    value={editorValue}
                    onChange={html => updateJournalEntry({ text: html })}
                    placeholder={t('Текст записи… Картинки можно перетащить прямо сюда.')}
                  />
                </div>

                <footer className="diary-footer">
                  <span>{new Date(selectedJournalEntry.updatedAt).toLocaleString(locale)}</span>
                  <button type="button" onClick={persistCurrentJournal}>{t('Сохранить')}</button>
                  <button type="button" className="danger" onClick={deleteJournalEntry}>{t('Удалить')}</button>
                </footer>
              </>
            ) : (
              <p className="panel-empty">{t('Создайте первую запись.')}</p>
            )}
          </section>
        </div>
      )}

      <style>{`
        .diary-sidebar {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
        }

        .diary-layout {
          display: grid;
          grid-template-columns: 140px minmax(0, 1fr);
          min-height: 0;
          height: 100%;
          overflow: hidden;
        }

        .diary-list {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 6px;
          padding: 8px 6px 8px 8px;
          border-right: 1px solid rgba(151,44,44,0.28);
          overflow: hidden;
        }

        .diary-list input {
          box-sizing: border-box;
          width: 100%;
          min-height: 30px;
          padding: 0 8px;
          background: rgba(12,10,10,0.88);
          border: 1px solid rgba(151,44,44,0.6);
          border-radius: 5px;
          color: #fff8ef;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .diary-list input:focus {
          border-color: #d6aa65;
        }

        .diary-list > button {
          min-height: 28px;
          padding: 0 6px;
          border: 1px solid rgba(151,44,44,0.5);
          border-radius: 5px;
          background: rgba(20,14,12,0.8);
          color: #e8d8c4;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .diary-list > button:hover {
          border-color: #d6aa65;
          background: rgba(52,22,18,0.86);
        }

        .diary-entries {
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 4px;
        }

        .diary-entries button {
          display: grid;
          gap: 2px;
          text-align: left;
          border: 1px solid rgba(151,44,44,0.22);
          border-radius: 5px;
          background: rgba(18,14,12,0.7);
          color: #f0e8e0;
          padding: 6px 7px;
          font: inherit;
          cursor: pointer;
          width: 100%;
        }

        .diary-entries button:hover,
        .diary-entries button.active {
          border-color: #d6aa65;
          background: rgba(52,22,18,0.86);
        }

        .diary-entries button strong {
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fff7ed;
          display: block;
        }

        .diary-entries button span {
          font-size: 10px;
          color: #b8a89a;
          display: block;
        }

        .diary-editor {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          overflow: hidden;
        }

        .diary-title {
          box-sizing: border-box;
          width: 100%;
          min-height: 36px;
          padding: 0 10px;
          background: rgba(10,7,8,0.6);
          border: none;
          border-bottom: 1px solid rgba(151,44,44,0.28);
          color: #fff7ed;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          outline: none;
        }

        .diary-title:focus {
          background: rgba(20,10,10,0.8);
        }

        .diary-editor-body {
          overflow: hidden;
          display: grid;
          background: rgba(10,7,8,0.5);
        }

        .diary-footer {
          display: flex;
          gap: 6px;
          align-items: center;
          padding: 6px 8px;
          border-top: 1px solid rgba(151,44,44,0.28);
          background: rgba(10,7,8,0.6);
        }

        .diary-footer span {
          flex: 1;
          font-size: 10px;
          color: #b8a89a;
        }

        .diary-footer button {
          padding: 3px 8px;
          border: 1px solid rgba(151,44,44,0.5);
          border-radius: 5px;
          background: rgba(20,14,12,0.8);
          color: #e8d8c4;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .diary-footer button:hover {
          border-color: #d6aa65;
          background: rgba(52,22,18,0.86);
          color: #fff3e2;
        }

        .diary-footer button.danger {
          color: #ffb8b8;
          border-color: #7d2626;
        }

        .diary-footer button.danger:hover {
          border-color: #ff3131;
          background: rgba(80,10,10,0.8);
        }
      `}</style>
    </section>
  )
}
