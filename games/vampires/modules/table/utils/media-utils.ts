import { TABLE_IMAGE_BUCKET } from '../constants'
import type { TableLayer } from '../types'

export function getImageSize(src: string) {
  return new Promise<{ width: number; height: number }>(resolve => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 420, height: image.naturalHeight || 280 })
    image.onerror = () => resolve({ width: 420, height: 280 })
    image.src = src
  })
}

export function getVideoSize(src: string) {
  if (getEmbeddableVideoUrl(src)) return Promise.resolve({ width: 640, height: 360 })

  return new Promise<{ width: number; height: number }>(resolve => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth || 640, height: video.videoHeight || 360 })
      video.removeAttribute('src')
      video.load()
    }
    video.onerror = () => resolve({ width: 640, height: 360 })
    video.src = src
  })
}

export function getMediaSize(src: string, layerType: TableLayer['layerType']) {
  return layerType === 'video' ? getVideoSize(src) : getImageSize(src)
}

export function safeStorageName(name: string) {
  const cleanName = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleanName || 'image'
}

export function getStoragePathFromPublicUrl(publicUrl: string, bucket = TABLE_IMAGE_BUCKET) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0])
}

export function getImageNameFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const lastPart = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
    return lastPart || parsed.hostname || 'internet-media'
  } catch {
    return 'internet-media'
  }
}

export function isImageUrlCandidate(value: string) {
  const raw = value.trim()
  if (!raw) return false
  if (/^data:image\//i.test(raw) || /^blob:/i.test(raw)) return true

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return /\.(apng|avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(parsed.pathname + parsed.search)
  } catch {
    return false
  }
}

export function isVideoUrlCandidate(value: string) {
  const raw = value.trim()
  if (!raw) return false
  if (/^data:video\//i.test(raw) || /^blob:/i.test(raw)) return true
  if (getEmbeddableVideoUrl(raw)) return true

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return /\.(mp4|webm|mov|m4v|ogv|ogg)(?:$|[?#])/i.test(parsed.pathname + parsed.search)
  } catch {
    return false
  }
}

export function getYouTubeId(url: string) {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || ''
    if (!hostname.endsWith('youtube.com') && !hostname.endsWith('youtube-nocookie.com')) return ''

    if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || ''
    return ''
  } catch {
    return ''
  }
}

export function getEmbeddableVideoUrl(url: string) {
  const youtubeId = getYouTubeId(url)
  if (!youtubeId) return ''
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0&enablejsapi=1&controls=1&fs=1`
}

export function getMediaUrlCandidate(url: string) {
  if (isImageUrlCandidate(url)) return { url, layerType: 'image' as const }
  if (isVideoUrlCandidate(url)) return { url, layerType: 'video' as const }
  return null
}

export function extractImageUrlsFromHtml(html: string) {
  if (!html.trim()) return []
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')
  const urls: string[] = []

  documentFragment.querySelectorAll('img, source').forEach(element => {
    const src = element.getAttribute('src') || element.getAttribute('data-src')
    if (src) urls.push(src)
    const srcset = element.getAttribute('srcset')
    if (srcset) {
      const firstSrc = srcset.split(',')[0]?.trim().split(/\s+/)[0]
      if (firstSrc) urls.push(firstSrc)
    }
  })

  documentFragment.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(element => {
    const content = element.getAttribute('content')
    if (content) urls.push(content)
  })

  return urls
}

export function extractVideoUrlsFromHtml(html: string) {
  if (!html.trim()) return []
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')
  const urls: string[] = []

  documentFragment.querySelectorAll('video, source').forEach(element => {
    const src = element.getAttribute('src') || element.getAttribute('data-src')
    if (src) urls.push(src)
  })

  documentFragment.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[name="twitter:player:stream"]').forEach(element => {
    const content = element.getAttribute('content')
    if (content) urls.push(content)
  })

  return urls
}

export function getDroppedMediaUrls(dataTransfer: DataTransfer) {
  const candidates: string[] = []
  candidates.push(...extractImageUrlsFromHtml(dataTransfer.getData('text/html')))
  candidates.push(...extractVideoUrlsFromHtml(dataTransfer.getData('text/html')))
  candidates.push(
    ...dataTransfer
      .getData('text/uri-list')
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith('#'))
  )
  candidates.push(dataTransfer.getData('text/plain'))

  return [...new Set(candidates.map(value => value.trim()))]
    .map(getMediaUrlCandidate)
    .filter((item): item is { url: string; layerType: 'image' | 'video' } => Boolean(item))
}

export function getMediaUrlsFromText(value: string) {
  return [...new Set(value.split(/\s+/).map(item => item.trim()).filter(Boolean))]
    .map(getMediaUrlCandidate)
    .filter((item): item is { url: string; layerType: 'image' | 'video' } => Boolean(item))
}

export type TablePastePayload =
  | { kind: 'files'; files: File[] }
  | { kind: 'media-urls'; items: Array<{ url: string; layerType: 'image' | 'video' }> }
  | { kind: 'text'; text: string; title: string }

export function isEditablePasteTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.closest('.ProseMirror, .je-root, .tiptap, [role="textbox"]')) return true
  return false
}

function collectClipboardFiles(clipboardData: DataTransfer) {
  const files: File[] = []
  const seen = new Set<string>()

  const pushFile = (file: File | null) => {
    if (!file) return
    const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`
    if (seen.has(key)) return
    seen.add(key)
    files.push(file)
  }

  Array.from(clipboardData.items || []).forEach(item => {
    if (item.kind !== 'file') return
    pushFile(item.getAsFile())
  })
  Array.from(clipboardData.files || []).forEach(file => pushFile(file))

  return files
}

export function getTextNoteTitle(text: string, fallback = 'Текст') {
  const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
  if (!firstLine) return fallback
  return firstLine.length > 48 ? `${firstLine.slice(0, 45)}…` : firstLine
}

export function parseClipboardForTablePaste(clipboardData: DataTransfer, textTitleFallback = 'Текст'): TablePastePayload | null {
  const files = collectClipboardFiles(clipboardData)
  if (files.length > 0) return { kind: 'files', files }

  const mediaUrls = getDroppedMediaUrls(clipboardData)
  if (mediaUrls.length > 0) return { kind: 'media-urls', items: mediaUrls }

  const plain = clipboardData.getData('text/plain').trim()
  if (!plain) return null

  const urlOnlyItems = getMediaUrlsFromText(plain)
  const plainTokens = plain.split(/\s+/).map(item => item.trim()).filter(Boolean)
  if (urlOnlyItems.length > 0 && urlOnlyItems.length === plainTokens.length) {
    return { kind: 'media-urls', items: urlOnlyItems }
  }

  return {
    kind: 'text',
    text: plain,
    title: getTextNoteTitle(plain, textTitleFallback),
  }
}

export function isReadableTextFile(file: File) {
  const name = file.name.toLowerCase()
  return file.type.startsWith('text/') || /\.(txt|md|markdown|rtf|html?|css|json|csv|xml|svg)$/i.test(name)
}

export function isWordLikeFile(file: File) {
  return /\.(docx?|odt)$/i.test(file.name) || /wordprocessingml|msword|opendocument\.text/i.test(file.type)
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function getFileText(file: File) {
  return file.text()
}

export function getTextLayerData(file: File, text: string) {
  if (/\.html?$/i.test(file.name) || /html/i.test(file.type)) return text
  if (/\.rtf$/i.test(file.name) || /rtf/i.test(file.type)) {
    return `<pre>${escapeHtml(text.replace(/\\'[0-9a-fA-F]{2}/g, '').replace(/[{}]/g, '').replace(/\\[a-z]+-?\\d* ?/g, ''))}</pre>`
  }
  return `<pre>${escapeHtml(text)}</pre>`
}

export function getFileLayerMeta(value: string, fallbackName = '') {
  try {
    const parsed = JSON.parse(value) as { url?: string; type?: string; wordLike?: boolean; pdf?: boolean; name?: string }
    const name = parsed.name || fallbackName
    return {
      url: parsed.url || '',
      type: parsed.type || 'file',
      wordLike: Boolean(parsed.wordLike),
      pdf: Boolean(parsed.pdf) || /\.pdf$/i.test(name) || /pdf/i.test(parsed.type || ''),
      name,
    }
  } catch {
    return { url: value, type: 'file', wordLike: /\.(docx?|odt)$/i.test(fallbackName), pdf: /\.pdf$/i.test(fallbackName), name: fallbackName }
  }
}

export function getDocumentEmbedUrl(meta: ReturnType<typeof getFileLayerMeta>) {
  if (!meta.url) return ''
  if (meta.pdf) return meta.url
  if (meta.wordLike) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(meta.url)}`
  return ''
}
