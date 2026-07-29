import { extractImageUrlsFromHtml, getStoragePathFromPublicUrl } from './media-utils'
import type { JournalEntry } from '../types'

export function getJournalReferencedMediaUrls(currentEntries: JournalEntry[]) {
  if (typeof window === 'undefined') return new Set<string>()
  const entries = [...currentEntries]

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith('vtm-journal:')) continue
      const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
      if (Array.isArray(parsed)) entries.push(...parsed)
    }
  } catch (error) {
    console.warn('Не удалось проверить ссылки дневника перед удалением медиа:', error)
  }

  const urls = new Set<string>()
  entries.forEach(entry => {
    extractImageUrlsFromHtml(entry.text || '').forEach(url => urls.add(url))
    entry.attachments?.forEach(attachment => {
      if (attachment.kind === 'image' && attachment.url) urls.add(attachment.url)
    })
  })
  return urls
}

export function isMediaUrlReferencedInJournal(url: string, journalUrls: Set<string>) {
  if (!url) return false
  if (journalUrls.has(url)) return true
  const storagePath = getStoragePathFromPublicUrl(url)
  if (!storagePath) return false
  for (const journalUrl of journalUrls) {
    if (getStoragePathFromPublicUrl(journalUrl) === storagePath) return true
  }
  return false
}