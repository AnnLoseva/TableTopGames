'use client'

import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import type { ChapterDoc } from '../types'
import styles from './ChapterEditor.module.css'

type Props = {
  initialContent: ChapterDoc
  /** Bumped by the route when a different chapter is loaded into this editor. */
  documentKey: string
  onChange: (doc: ChapterDoc, text: string) => void
}

const TOOLS = [
  { id: 'bold', label: 'B', title: 'Полужирный', style: { fontWeight: 700 } },
  { id: 'italic', label: 'I', title: 'Курсив', style: { fontStyle: 'italic' } },
  { id: 'h2', label: 'H', title: 'Заголовок' },
  { id: 'quote', label: '❝', title: 'Цитата' },
  { id: 'rule', label: '⁂', title: 'Разрыв сцены' },
] as const

/**
 * The writing canvas: a calm, single-column TipTap surface with a minimal
 * floating toolbar. Everything else (title, timeline, publishing) lives in the
 * route's side panel, so the middle of the screen stays text.
 */
export default function ChapterEditor({ initialContent, documentKey, onChange }: Props) {
  const editor = useEditor({
    // Next renders this on the server first; TipTap must wait for the client.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: 'Текст главы…' }),
    ],
    // `ChapterDoc` is the stored shape of exactly this: a TipTap document.
    content: initialContent as unknown as JSONContent,
    onUpdate({ editor: instance }) {
      onChange(instance.getJSON() as ChapterDoc, instance.getText())
    },
  }, [documentKey])

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(initialContent as unknown as JSONContent, { emitUpdate: false })
    }
    // Only when the route swaps in another chapter — never on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey, editor])

  if (!editor) return <div className={styles.loading}>Готовлю редактор…</div>

  const run = (id: (typeof TOOLS)[number]['id']) => {
    const chain = editor.chain().focus()
    if (id === 'bold') chain.toggleBold().run()
    else if (id === 'italic') chain.toggleItalic().run()
    else if (id === 'h2') chain.toggleHeading({ level: 2 }).run()
    else if (id === 'quote') chain.toggleBlockquote().run()
    else if (id === 'rule') chain.setHorizontalRule().run()
  }

  const isActive = (id: (typeof TOOLS)[number]['id']) => {
    if (id === 'h2') return editor.isActive('heading', { level: 2 })
    if (id === 'quote') return editor.isActive('blockquote')
    if (id === 'rule') return false
    return editor.isActive(id)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            type="button"
            title={tool.title}
            className={`${styles.tool} ${isActive(tool.id) ? styles.toolActive : ''}`}
            style={'style' in tool ? tool.style : undefined}
            onMouseDown={event => {
              event.preventDefault()
              run(tool.id)
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className={styles.canvas} />
    </div>
  )
}
