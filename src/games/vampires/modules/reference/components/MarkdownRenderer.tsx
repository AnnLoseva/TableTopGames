'use client'

import { type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

type MarkdownRendererProps = {
  markdown: string
  searchTerms?: string[]
  activeMatchIndex?: number
  onInternalLink?: (href: string) => void
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightChildren(children: ReactNode, terms: string[], activeMatchIndex: number, counter: { value: number }): ReactNode {
  if (terms.length === 0) return children

  if (typeof children === 'string') {
    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
    return children.split(pattern).map((part, index) => {
      if (!terms.some(term => part.toLowerCase() === term.toLowerCase())) return part
      const matchIndex = counter.value
      counter.value += 1
      return (
        <mark
          className={`reference-search-hit ${matchIndex === activeMatchIndex ? 'active' : ''}`}
          id={`reference-search-hit-${matchIndex}`}
          key={`${part}-${index}-${matchIndex}`}
        >
          {part}
        </mark>
      )
    })
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <span className="reference-highlight-fragment" key={index}>
        {highlightChildren(child, terms, activeMatchIndex, counter)}
      </span>
    ))
  }

  return children
}

function isInternalReferenceHref(href?: string) {
  return Boolean(href && (href.startsWith('/reference?') || href.startsWith('?doc=')))
}

export default function MarkdownRenderer({
  markdown,
  searchTerms = [],
  activeMatchIndex = -1,
  onInternalLink,
}: MarkdownRendererProps) {
  const counter = { value: 0 }
  const highlight = (children: ReactNode) => highlightChildren(children, searchTerms, activeMatchIndex, counter)

  return (
    <article className="reference-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          h1: ({ children, ...props }) => <h1 {...props}>{highlight(children)}</h1>,
          h2: ({ children, ...props }) => <h2 {...props}>{highlight(children)}</h2>,
          h3: ({ children, ...props }) => <h3 {...props}>{highlight(children)}</h3>,
          h4: ({ children, ...props }) => <h4 {...props}>{highlight(children)}</h4>,
          p: ({ children }) => <p>{highlight(children)}</p>,
          li: ({ children }) => <li>{highlight(children)}</li>,
          strong: ({ children }) => <strong>{highlight(children)}</strong>,
          em: ({ children }) => <em>{highlight(children)}</em>,
          blockquote: ({ children }) => <blockquote className="reference-callout">{children}</blockquote>,
          a: ({ children, href, ...props }) => {
            const internal = isInternalReferenceHref(href)
            return (
              <a
                {...props}
                href={href}
                onClick={event => {
                  if (!internal || !href || !onInternalLink) return
                  event.preventDefault()
                  onInternalLink(href)
                }}
                target={!internal && href?.startsWith('http') ? '_blank' : undefined}
                rel={!internal && href?.startsWith('http') ? 'noreferrer' : undefined}
              >
                {highlight(children)}
              </a>
            )
          },
          th: ({ children }) => <th>{highlight(children)}</th>,
          td: ({ children }) => <td>{highlight(children)}</td>,
          table: ({ children }) => (
            <div className="reference-table-wrap">
              <table>{children}</table>
            </div>
          ),
          input: ({ ...props }) => <input {...props} disabled />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  )
}