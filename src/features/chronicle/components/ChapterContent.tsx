import { Fragment, type ReactNode } from 'react'
import type { ChapterDoc } from '../types'
import styles from './ChapterContent.module.css'

/**
 * Renders a TipTap document as React elements.
 *
 * Deliberately a walker rather than `generateHTML` + `dangerouslySetInnerHTML`:
 * the reader's page never interprets stored markup as HTML, so a chapter's
 * content cannot inject anything into the page, and the typography stays in
 * this stylesheet instead of inside the stored document.
 */

type Mark = { type: string; attrs?: Record<string, unknown> }
type Node = {
  type: string
  text?: string
  marks?: Mark[]
  attrs?: Record<string, unknown>
  content?: Node[]
}

function applyMarks(text: ReactNode, marks: Mark[] | undefined, keyBase: string): ReactNode {
  if (!marks || marks.length === 0) return text
  return marks.reduce<ReactNode>((acc, mark, index) => {
    const key = `${keyBase}-m${index}`
    switch (mark.type) {
      case 'bold': return <strong key={key}>{acc}</strong>
      case 'italic': return <em key={key}>{acc}</em>
      case 'strike': return <s key={key}>{acc}</s>
      case 'code': return <code key={key}>{acc}</code>
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''
        // Stored links are author-written, but never trust a stored scheme:
        // anything but http(s) is rendered as plain text.
        if (!/^https?:\/\//i.test(href)) return acc
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">{acc}</a>
        )
      }
      default: return acc
    }
  }, text)
}

function renderNodes(nodes: Node[] | undefined, keyBase: string): ReactNode {
  if (!nodes) return null
  return nodes.map((node, index) => renderNode(node, `${keyBase}-${index}`))
}

function renderNode(node: Node, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return <Fragment key={key}>{applyMarks(node.text ?? '', node.marks, key)}</Fragment>
    case 'paragraph':
      return <p key={key}>{renderNodes(node.content, key)}</p>
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 4)
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4'
      return <Tag key={key}>{renderNodes(node.content, key)}</Tag>
    }
    case 'blockquote':
      return <blockquote key={key}>{renderNodes(node.content, key)}</blockquote>
    case 'bulletList':
      return <ul key={key}>{renderNodes(node.content, key)}</ul>
    case 'orderedList':
      return <ol key={key}>{renderNodes(node.content, key)}</ol>
    case 'listItem':
      return <li key={key}>{renderNodes(node.content, key)}</li>
    case 'codeBlock':
      return <pre key={key}><code>{renderNodes(node.content, key)}</code></pre>
    case 'horizontalRule':
      return <hr key={key} className={styles.divider} />
    case 'hardBreak':
      return <br key={key} />
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      if (!/^https?:\/\//i.test(src)) return null
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={key} src={src} alt={alt} className={styles.image} />
    }
    default:
      return <Fragment key={key}>{renderNodes(node.content, key)}</Fragment>
  }
}

export default function ChapterContent({ doc }: { doc: ChapterDoc }) {
  const nodes = Array.isArray(doc.content) ? (doc.content as Node[]) : []
  if (nodes.length === 0) return null
  return <div className={styles.prose}>{renderNodes(nodes, 'n')}</div>
}
