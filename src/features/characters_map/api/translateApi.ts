import { createCharactersMapClient } from '../supabase'
import { computeCharacterSourceHash, computeRelationshipSourceHash } from '../i18n'
import type { CharacterTranslation, MapCharacter, MapRelationship, RelationshipTranslation } from '../types'

type MapClient = ReturnType<typeof createCharactersMapClient>
type TranslateItem = { key: string; text: string }

async function invokeTranslate(client: MapClient, items: TranslateItem[]): Promise<Record<string, string>> {
  if (items.length === 0) return {}
  const { data, error } = await client.functions.invoke('characters-map-translate', { body: { items } })
  if (error) throw error
  return (data?.translations as Record<string, string>) ?? {}
}

export async function translateCharacterToEnglish(client: MapClient, character: MapCharacter): Promise<CharacterTranslation> {
  const sheet = character.sheet
  const items: TranslateItem[] = [
    { key: 'name', text: character.name },
    { key: 'description', text: character.description },
    { key: 'concept', text: sheet.concept },
    { key: 'clan', text: sheet.clan },
    { key: 'generation', text: sheet.generation },
    { key: 'predatorType', text: sheet.predatorType },
    { key: 'sire', text: sheet.sire },
    { key: 'ambition', text: sheet.ambition },
    { key: 'desire', text: sheet.desire },
    { key: 'touchstones', text: sheet.touchstones },
    { key: 'merits', text: sheet.merits },
    { key: 'flaws', text: sheet.flaws },
    { key: 'birthDateLabel', text: sheet.birthDateLabel },
    ...sheet.disciplines.map(d => ({ key: `discipline:${d.id}`, text: d.name })),
    ...sheet.events.flatMap(e => [
      { key: `event:${e.id}:title`, text: e.title },
      { key: `event:${e.id}:description`, text: e.description },
    ]),
    ...sheet.gallery.map(g => ({ key: `gallery:${g.id}`, text: g.caption })),
  ]
  const translations = await invokeTranslate(client, items)
  const events: Record<string, { title: string; description: string }> = {}
  for (const event of sheet.events) {
    const title = translations[`event:${event.id}:title`] || ''
    const description = translations[`event:${event.id}:description`] || ''
    if (title || description) events[event.id] = { title, description }
  }
  const disciplines: Record<string, string> = {}
  for (const discipline of sheet.disciplines) {
    const translated = translations[`discipline:${discipline.id}`]
    if (translated) disciplines[discipline.id] = translated
  }
  const gallery: Record<string, string> = {}
  for (const item of sheet.gallery) {
    const translated = translations[`gallery:${item.id}`]
    if (translated) gallery[item.id] = translated
  }
  return {
    name: translations.name || '',
    description: translations.description || '',
    concept: translations.concept || '',
    clan: translations.clan || '',
    generation: translations.generation || '',
    predatorType: translations.predatorType || '',
    sire: translations.sire || '',
    ambition: translations.ambition || '',
    desire: translations.desire || '',
    touchstones: translations.touchstones || '',
    merits: translations.merits || '',
    flaws: translations.flaws || '',
    birthDateLabel: translations.birthDateLabel || '',
    disciplines,
    events,
    gallery,
    sourceHash: computeCharacterSourceHash(character),
    translatedAt: new Date().toISOString(),
  }
}

export async function translateRelationshipToEnglish(client: MapClient, relationship: MapRelationship): Promise<RelationshipTranslation> {
  const items: TranslateItem[] = [
    { key: 'label', text: relationship.label },
    { key: 'description', text: relationship.description },
    ...relationship.events.flatMap(event => [
      { key: `event:${event.id}:title`, text: event.title },
      ...(event.label !== undefined ? [{ key: `event:${event.id}:label`, text: event.label }] : []),
      ...(event.description !== undefined ? [{ key: `event:${event.id}:description`, text: event.description }] : []),
    ]),
  ]
  const translations = await invokeTranslate(client, items)
  const events: Record<string, { title?: string; label?: string; description?: string }> = {}
  for (const event of relationship.events) {
    const entry: { title?: string; label?: string; description?: string } = {}
    const title = translations[`event:${event.id}:title`]
    const label = translations[`event:${event.id}:label`]
    const description = translations[`event:${event.id}:description`]
    if (title) entry.title = title
    if (label) entry.label = label
    if (description) entry.description = description
    if (Object.keys(entry).length > 0) events[event.id] = entry
  }
  return {
    label: translations.label || '',
    description: translations.description || '',
    events,
    sourceHash: computeRelationshipSourceHash(relationship),
    translatedAt: new Date().toISOString(),
  }
}
