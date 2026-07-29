import { REFERENCE_DOCUMENTS, getReferenceDocumentUrl } from '@/games/vampires/modules/reference/catalog'
import { STANDARD_LORE_CATEGORIES } from '../constants'
import type { SystemReferenceHit } from '../types'

/**
 * Adapter over modules/reference — does NOT copy public/vampires/rules.json into Supabase.
 * Surfaces system VTM docs as search hits for lore categories.
 */
export function listSystemReferenceHits(categorySlug?: string | null): SystemReferenceHit[] {
  const standards = STANDARD_LORE_CATEGORIES.filter(item => item.systemReferenceSlug)
  const filtered = categorySlug
    ? standards.filter(item => item.slug === categorySlug)
    : standards

  return filtered.flatMap(category => {
    const doc = REFERENCE_DOCUMENTS.find(item => item.slug === category.systemReferenceSlug)
    if (!doc) return []
    return [{
      id: `system:${doc.slug}`,
      source: 'system' as const,
      categorySlug: category.slug,
      title: doc.title,
      shortSummary: doc.description,
      referenceSlug: doc.slug,
      tags: ['system', 'v5', category.slug],
    }]
  })
}

export function searchSystemReference(query: string, categorySlug?: string | null): SystemReferenceHit[] {
  const q = query.trim().toLowerCase()
  const all = listSystemReferenceHits(categorySlug)
  if (!q) return all
  return all.filter(hit => (
    hit.title.toLowerCase().includes(q)
    || hit.shortSummary.toLowerCase().includes(q)
    || hit.tags.some(tag => tag.toLowerCase().includes(q))
  ))
}

export function systemReferenceHref(hit: SystemReferenceHit): string {
  return getReferenceDocumentUrl(hit.referenceSlug)
}
