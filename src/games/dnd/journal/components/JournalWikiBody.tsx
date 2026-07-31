'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { createAccountClient } from '@/platform/account/supabase'
import { getJournalImageUrl } from '../api/images-api'
import {
  decodeWikiHref,
  findImageByName,
  findPageByWikiTitle,
  standaloneImageName,
  wikiToMarkdown,
} from '../wiki-markup'
import type { DndJournalImage, DndJournalPage } from '../types'
import styles from './DndJournalRoute.module.css'

type JournalWikiBodyProps = {
  client: ReturnType<typeof createAccountClient>
  source: string
  pages: DndJournalPage[]
  images: DndJournalImage[]
  onOpenPage: (title: string) => void
}

/**
 * react-markdown's default `urlTransform` only lets http(s)/irc(s)/mailto/xmpp
 * URLs through and blanks out anything else (including our `dnd-page:`/
 * `dnd-image:` scheme) — which made every `[[wiki link]]` render with an
 * empty href, falling through to a real `<a target="_blank">` that opened a
 * blank new tab instead of navigating in-app. Let our own schemes through
 * unchanged; everything else still goes through the default sanitizer.
 */
function wikiUrlTransform(url: string): string {
  if (url.startsWith('dnd-page:') || url.startsWith('dnd-image:')) return url
  return defaultUrlTransform(url)
}

/**
 * Reading view for journal bodies. Ordinary Markdown (via remark-gfm) plus
 * the app's wiki conventions:
 *   [[Title]]   → opens an existing page or offers creation
 *   ![[name]]   → embeds a journal image by display name
 */
export default function JournalWikiBody({
  client,
  source,
  pages,
  images,
  onOpenPage,
}: JournalWikiBodyProps) {
  const blocks = useMemo(() => splitBlocks(source), [source])
  const [fullscreenImage, setFullscreenImage] = useState<DndJournalImage | null>(null)

  useEffect(() => {
    if (!fullscreenImage) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenImage(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenImage])

  if (!source.trim()) {
    return <p className={styles.wikiEmpty}>Пусто</p>
  }

  return (
    <div className={styles.bodyPreview}>
      {blocks.map((block, index) => {
        if (block.kind === 'image') {
          return (
            <StandaloneImage
              key={`img-${index}-${block.name}`}
              client={client}
              name={block.name}
              images={images}
              onOpenImage={setFullscreenImage}
            />
          )
        }
        return (
          <ReactMarkdown
            key={`md-${index}`}
            remarkPlugins={[remarkGfm]}
            urlTransform={wikiUrlTransform}
            components={{
              a: ({ href, children }) => (
                <WikiAnchor
                  href={href}
                  pages={pages}
                  onOpenPage={onOpenPage}
                >
                  {children}
                </WikiAnchor>
              ),
              img: ({ src, alt }) => (
                <WikiImage
                  client={client}
                  src={typeof src === 'string' ? src : undefined}
                  alt={alt}
                  images={images}
                  onOpenImage={setFullscreenImage}
                />
              ),
            }}
          >
            {wikiToMarkdown(block.markdown)}
          </ReactMarkdown>
        )
      })}
      {fullscreenImage && (
        <div
          className={styles.modalScrim}
          role="presentation"
          onMouseDown={() => setFullscreenImage(null)}
        >
          <div
            className={styles.imageLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={fullscreenImage.name || 'Изображение'}
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.imageLightboxClose}
              onClick={() => setFullscreenImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img src={getJournalImageUrl(client, fullscreenImage.storagePath)} alt={fullscreenImage.name} />
            {fullscreenImage.name && (
              <span className={styles.imageLightboxCaption}>{fullscreenImage.name}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type BodyBlock =
  | { kind: 'image'; name: string }
  | { kind: 'markdown'; markdown: string }

function splitBlocks(source: string): BodyBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: BodyBlock[] = []
  let buffer: string[] = []

  const flush = () => {
    if (buffer.length === 0) return
    blocks.push({ kind: 'markdown', markdown: buffer.join('\n') })
    buffer = []
  }

  for (const line of lines) {
    const imageName = standaloneImageName(line)
    if (imageName !== null) {
      flush()
      blocks.push({ kind: 'image', name: imageName })
    } else {
      buffer.push(line)
    }
  }
  flush()
  return blocks
}

function WikiAnchor({
  href,
  pages,
  onOpenPage,
  children,
}: {
  href?: string
  pages: DndJournalPage[]
  onOpenPage: (title: string) => void
  children?: ReactNode
}) {
  const pageTitle = decodeWikiHref(href, 'dnd-page')
  if (pageTitle !== null) {
    const exists = Boolean(findPageByWikiTitle(pages, pageTitle))
    return (
      <button
        type="button"
        className={exists ? styles.wikiLink : styles.wikiLinkBroken}
        onClick={() => onOpenPage(pageTitle)}
      >
        {children}
      </button>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

function WikiImage({
  client,
  src,
  alt,
  images,
  onOpenImage,
}: {
  client: ReturnType<typeof createAccountClient>
  src?: string
  alt?: string
  images: DndJournalImage[]
  onOpenImage: (image: DndJournalImage) => void
}) {
  const imageName = decodeWikiHref(src, 'dnd-image') ?? alt ?? ''
  const image = findImageByName(images, imageName)
  if (!image) {
    return <span className={styles.wikiImageMissing}>[изобр: {imageName || 'не найдено'}]</span>
  }
  return (
    <span className={styles.wikiImageInline} title={image.name}>
      <button type="button" className={styles.wikiImageButton} onClick={() => onOpenImage(image)}>
        <img src={getJournalImageUrl(client, image.storagePath)} alt={image.name} />
      </button>
    </span>
  )
}

function StandaloneImage({
  client,
  name,
  images,
  onOpenImage,
}: {
  client: ReturnType<typeof createAccountClient>
  name: string
  images: DndJournalImage[]
  onOpenImage: (image: DndJournalImage) => void
}) {
  const image = findImageByName(images, name)
  if (!image) {
    return (
      <figure className={styles.wikiImageMissingBlock}>
        изображение не найдено: {name}
      </figure>
    )
  }
  return (
    <figure className={styles.wikiImageBlock}>
      <button type="button" className={styles.wikiImageButton} onClick={() => onOpenImage(image)}>
        <img src={getJournalImageUrl(client, image.storagePath)} alt={image.name} />
      </button>
      <figcaption>{image.name}</figcaption>
    </figure>
  )
}

