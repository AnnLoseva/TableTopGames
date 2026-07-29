'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { forwardRef, useImperativeHandle, useEffect } from 'react'
import { ResizableImage } from './ResizableImageExtension'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

// ─── helpers ─────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function extractImageUrlsFromTransfer(dt: DataTransfer): string[] {
  const urls: string[] = []
  const html = dt.getData('text/html')
  if (html) {
    const m = [...html.matchAll(/src="([^"]+)"/gi)]
    urls.push(...m.map(r => r[1]))
  }
  dt.getData('text/uri-list').split(/\r?\n/).forEach(l => {
    if (l && !l.startsWith('#') && /\.(jpg|jpeg|png|gif|webp|svg|avif)/i.test(l)) urls.push(l)
  })
  const plain = dt.getData('text/plain').trim()
  if (/^(https?:|data:image\/|blob:)/i.test(plain)) urls.push(plain)
  return [...new Set(urls.map(s => s.trim()).filter(Boolean))]
}

// ─── public handle ────────────────────────────────────────────────────────────

export type JournalEditorHandle = {
  insertImage: (src: string, alt?: string) => void
  focus: () => void
}

// ─── toolbar button ───────────────────────────────────────────────────────────

function Btn({
  active,
  title,
  onClick,
  children,
  compact,
}: {
  active?: boolean
  title?: string
  onClick: () => void
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => {
        e.preventDefault()
        onClick()
      }}
      style={{
        padding: compact ? '2px 6px' : '3px 8px',
        minWidth: compact ? 26 : 32,
        border: `1px solid ${active ? '#d6aa65' : 'rgba(151,44,44,0.5)'}`,
        borderRadius: 5,
        background: active ? 'rgba(214,170,101,0.18)' : 'rgba(20,14,12,0.7)',
        color: active ? '#ffd89a' : '#e8d8c4',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: compact ? 11 : 13,
        lineHeight: '1.3',
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      {children}
    </button>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

interface JournalEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Compact mode for use inside panels (smaller toolbar, tighter padding) */
  compact?: boolean
}

const JournalEditor = forwardRef<JournalEditorHandle, JournalEditorProps>(
  function JournalEditor({ value, onChange, placeholder = 'Текст записи…', compact = false }, ref) {
    const { t } = useLang()
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ link: false }),
        ResizableImage,
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({ placeholder: t(placeholder) }),
      ],
      content: value,
      onUpdate({ editor: ed }) {
        onChange(ed.getHTML())
      },
      editorProps: {
        handleDrop(view, event) {
          if (!event.dataTransfer) return false
          const files = Array.from(event.dataTransfer.files ?? []).filter(f =>
            f.type.startsWith('image/'),
          )
          const urls = extractImageUrlsFromTransfer(event.dataTransfer)
          if (files.length === 0 && urls.length === 0) return false
          event.preventDefault()

          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          const insertPos = coords?.pos ?? view.state.doc.content.size

          files.forEach(async file => {
            const src = await readFileAsDataUrl(file)
            const node = view.state.schema.nodes.image.create({ src, alt: file.name })
            view.dispatch(view.state.tr.insert(insertPos, node))
          })
          urls.forEach(src => {
            const node = view.state.schema.nodes.image.create({ src })
            view.dispatch(view.state.tr.insert(insertPos, node))
          })
          return true
        },

        handlePaste(view, event) {
          const items = Array.from(event.clipboardData?.items ?? [])
          const imageItems = items.filter(i => i.type.startsWith('image/'))
          if (imageItems.length === 0) return false
          event.preventDefault()
          imageItems.forEach(item => {
            const file = item.getAsFile()
            if (!file) return
            readFileAsDataUrl(file).then(src => {
              const node = view.state.schema.nodes.image.create({ src })
              view.dispatch(view.state.tr.replaceSelectionWith(node))
            })
          })
          return true
        },
      },
    })

    useEffect(() => {
      if (!editor) return
      if (editor.getHTML() !== value) {
        editor.commands.setContent(value ?? '', { emitUpdate: false })
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    useImperativeHandle(ref, () => ({
      insertImage(src: string, alt = t('Изображение')) {
        if (!editor) return
        editor.chain().focus().insertContent({ type: 'image', attrs: { src, alt } }).run()
      },
      focus() {
        editor?.commands.focus()
      },
    }))

    if (!editor) return null

    const c = compact  // shorthand

    const isBold       = editor.isActive('bold')
    const isItalic     = editor.isActive('italic')
    const isStrike     = editor.isActive('strike')
    const isH1         = editor.isActive('heading', { level: 1 })
    const isH2         = editor.isActive('heading', { level: 2 })
    const isBullet     = editor.isActive('bulletList')
    const isOrdered    = editor.isActive('orderedList')
    const isBlockquote = editor.isActive('blockquote')

    return (
      <div className={`je-root${c ? ' je-compact' : ''}`}>
        {/* ── Toolbar ── */}
        <div className="je-toolbar">
          <Btn compact={c} active={isBold}       title={t('Жирный (Ctrl+B)')}        onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
          <Btn compact={c} active={isItalic}     title={t('Курсив (Ctrl+I)')}         onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
          <Btn compact={c} active={isStrike}     title={t('Зачёркнутый')}             onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
          <span className="je-sep" />
          <Btn compact={c} active={isH1}         title={t('Заголовок 1')}             onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
          <Btn compact={c} active={isH2}         title={t('Заголовок 2')}             onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
          <span className="je-sep" />
          <Btn compact={c} active={isBullet}     title={t('Маркированный список')}    onClick={() => editor.chain().focus().toggleBulletList().run()}>☰</Btn>
          <Btn compact={c} active={isOrdered}    title={t('Нумерованный список')}     onClick={() => editor.chain().focus().toggleOrderedList().run()}>№</Btn>
          <Btn compact={c} active={isBlockquote} title={t('Цитата')}                  onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</Btn>
          <span className="je-sep" />
          <Btn compact={c}                       title={t('Горизонтальная линия')}    onClick={() => editor.chain().focus().setHorizontalRule().run()}>─</Btn>
          <Btn compact={c}                       title={t('Убрать форматирование')}   onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>✕</Btn>
        </div>

        {/* ── Editor area ── */}
        <EditorContent editor={editor} className="je-content" />

        <style>{`
          .je-root {
            display: grid;
            grid-template-rows: auto 1fr;
            min-height: 0;
            height: 100%;
          }

          .je-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 7px 10px;
            border-bottom: 1px solid rgba(151,44,44,0.3);
            background: rgba(10,7,8,0.6);
          }

          .je-compact .je-toolbar {
            gap: 3px;
            padding: 5px 8px;
          }

          .je-sep {
            width: 1px;
            align-self: stretch;
            background: rgba(151,44,44,0.3);
            margin: 0 2px;
          }

          .je-content {
            overflow: auto;
            padding: 14px 16px;
            cursor: text;
          }

          .je-compact .je-content {
            padding: 8px 10px;
          }

          .je-content .tiptap {
            outline: none;
            min-height: 200px;
            color: #fff8ef;
            font-family: "Courier New", Courier, monospace;
            font-size: 15px;
            line-height: 1.7;
            caret-color: #d6aa65;
          }

          .je-compact .je-content .tiptap {
            font-size: 13px;
            line-height: 1.6;
            min-height: 100px;
          }

          .je-content .tiptap p { margin: 0 0 0.75em; }
          .je-compact .je-content .tiptap p { margin: 0 0 0.5em; }

          .je-content .tiptap h1 {
            margin: 0.9em 0 0.45em;
            font-size: 1.55em;
            color: #fff7ed;
            letter-spacing: 0.02em;
          }

          .je-compact .je-content .tiptap h1 { font-size: 1.3em; margin: 0.6em 0 0.3em; }

          .je-content .tiptap h2 {
            margin: 0.7em 0 0.35em;
            font-size: 1.25em;
            color: #fff7ed;
          }

          .je-compact .je-content .tiptap h2 { font-size: 1.1em; margin: 0.5em 0 0.25em; }

          .je-content .tiptap strong { color: #ffd89a; }
          .je-content .tiptap em     { color: #e8cfa6; font-style: italic; }
          .je-content .tiptap s      { color: #998880; }

          .je-content .tiptap ul,
          .je-content .tiptap ol {
            margin: 0 0 0.75em 1.4em;
            padding: 0;
          }

          .je-content .tiptap li { margin-bottom: 0.3em; }

          .je-content .tiptap blockquote {
            margin: 0.6em 0;
            padding: 4px 14px;
            border-left: 3px solid #773030;
            color: #c8b09a;
            font-style: italic;
          }

          .je-content .tiptap hr {
            border: none;
            border-top: 1px solid rgba(151,44,44,0.5);
            margin: 1em 0;
          }

          .je-content .tiptap a {
            color: #ffd89a;
            text-decoration: underline;
          }

          .je-content .tiptap code {
            background: rgba(255,49,49,0.1);
            border: 1px solid rgba(255,49,49,0.2);
            border-radius: 3px;
            padding: 1px 5px;
            font-family: "Courier New", monospace;
            font-size: 0.92em;
          }

          .je-content .tiptap pre {
            background: rgba(8,5,6,0.8);
            border: 1px solid rgba(151,44,44,0.3);
            border-radius: 6px;
            padding: 12px 16px;
            overflow-x: auto;
            margin: 0.6em 0;
          }

          .je-content .tiptap pre code {
            background: none;
            border: none;
            padding: 0;
          }

          .je-content .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: rgba(184,168,154,0.5);
            pointer-events: none;
            height: 0;
          }

          .je-content .tiptap img {
            cursor: pointer;
          }
        `}</style>
      </div>
    )
  },
)

export default JournalEditor
