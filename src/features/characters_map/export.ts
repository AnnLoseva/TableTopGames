import { ATTRIBUTE_GROUPS, SKILL_GROUPS } from './constants'
import { attributeLabel, characterKindLabel, galleryCategoryLabel, groupTitle, skillLabel, t, type MapLanguage } from './i18n'
import type { CharacterSheet, DamageTrack, MapCharacter, MapRelationship } from './types'

function cleanText(value: string): string {
  return value.trim().replace(/\s*\n+\s*/g, ' ')
}

function characterMetaLine(sheet: CharacterSheet, language: MapLanguage): string {
  const s = t(language).export
  const parts = [
    sheet.concept,
    sheet.clan,
    sheet.generation ? s.generationWord(sheet.generation) : '',
    sheet.predatorType,
    sheet.sire ? s.sireWord(sheet.sire) : '',
  ].map(part => part.trim()).filter(Boolean)
  return parts.join(', ')
}

function formatTrack(track: DamageTrack, language: MapLanguage): string {
  const s = t(language).export
  let superficial = 0
  let aggravated = 0
  for (let i = 0; i < track.max; i += 1) {
    const state = track.boxes[i] ?? 0
    if (state === 1) superficial += 1
    else if (state === 2) aggravated += 1
  }
  const damaged = superficial + aggravated
  if (damaged === 0) return `${track.max} (${s.noDamage})`
  return s.damageSummary(track.max, damaged, superficial, aggravated)
}

function characterSheetLines(character: MapCharacter, language: MapLanguage): string[] {
  const s = t(language).export
  const sheet = character.sheet
  const lines: string[] = []

  const drives = [
    sheet.ambition.trim() ? `${s.ambitionLabel}: ${cleanText(sheet.ambition)}` : '',
    sheet.desire.trim() ? `${s.desireLabel}: ${cleanText(sheet.desire)}` : '',
  ].filter(Boolean)
  if (drives.length > 0) lines.push(`   ${drives.join(' | ')}`)

  const attributeGroupTexts = ATTRIBUTE_GROUPS
    .map(group => {
      const entries = group.keys
        .filter(([key]) => (sheet.attributes[key] ?? 0) > 0)
        .map(([key, label]) => `${attributeLabel(key, language, label)} ${sheet.attributes[key]}`)
      if (entries.length === 0) return ''
      return `${groupTitle(group.title, language)}: ${entries.join(', ')}`
    })
    .filter(Boolean)
  if (attributeGroupTexts.length > 0) lines.push(`   ${s.attributesLabel} — ${attributeGroupTexts.join(' | ')}`)

  const skillGroupTexts = SKILL_GROUPS
    .map(group => {
      const entries = group.keys
        .filter(([key]) => (sheet.skills[key] ?? 0) > 0)
        .map(([key, label]) => `${skillLabel(key, language, label)} ${sheet.skills[key]}`)
      if (entries.length === 0) return ''
      return `${groupTitle(group.title, language)}: ${entries.join(', ')}`
    })
    .filter(Boolean)
  if (skillGroupTexts.length > 0) lines.push(`   ${s.skillsLabel} — ${skillGroupTexts.join(' | ')}`)

  if (sheet.disciplines.length > 0) {
    const text = sheet.disciplines.map(d => `${d.name} ${d.level}`).join(', ')
    lines.push(`   ${s.disciplinesLabel}: ${text}`)
  }

  lines.push(`   ${s.healthLabel}: ${formatTrack(sheet.health, language)} | ${s.willpowerLabel}: ${formatTrack(sheet.willpower, language)}`)
  lines.push(`   ${s.humanityLabel}: ${sheet.humanity} (${s.stainsWord(sheet.stains)}) | ${s.bloodPotencyLabel}: ${sheet.bloodPotency}`)

  if (sheet.touchstones.trim()) lines.push(`   ${s.touchstonesLabel}: ${cleanText(sheet.touchstones)}`)
  if (sheet.merits.trim()) lines.push(`   ${s.meritsLabel}: ${cleanText(sheet.merits)}`)
  if (sheet.flaws.trim()) lines.push(`   ${s.flawsLabel}: ${cleanText(sheet.flaws)}`)

  const birth = sheet.birthDateLabel.trim() || (sheet.birthYear !== null ? String(sheet.birthYear) : s.unknownBirth)
  lines.push(`   ${s.bornLabel}: ${birth} (${characterKindLabel(sheet.baseKind, language)})`)

  if (sheet.events.length > 0) {
    lines.push(`   ${s.timelineLabel}:`)
    const sortedEvents = [...sheet.events].sort((a, b) => a.year - b.year)
    for (const event of sortedEvents) {
      let line = `     ${event.year} — ${event.title || s.eventFallback}`
      if (event.description.trim()) line += `: ${cleanText(event.description)}`
      if (event.kind) line += ` (${s.becameSpecies(characterKindLabel(event.kind, language))})`
      if (event.alive === false) line += ` (${s.diedWord})`
      else if (event.alive === true) line += ` (${s.aliveAgainWord})`
      lines.push(line)
    }
  }

  if (sheet.gallery.length > 0) {
    const text = sheet.gallery
      .map(item => `${galleryCategoryLabel(item.category, language)} — "${cleanText(item.caption)}"`)
      .join('; ')
    lines.push(`   ${s.galleryLabel}: ${text}`)
  }

  return lines
}

/**
 * Plain-text dump of the map for pasting into a chat with an AI (or anyone
 * else) that can't see the visual canvas — states every character's full
 * sheet and every relationship, with an explicit legend for the arrow
 * notation up front. Pass already-localized `characters`/`relationships`
 * (see `localizeCharacter`/`localizeRelationship` in `i18n.ts`) alongside the
 * matching `language` so the scaffold text and content agree.
 */
export function exportCharactersMapToText(
  characters: MapCharacter[],
  relationships: MapRelationship[],
  language: MapLanguage = 'ru',
): string {
  const s = t(language).export
  const byId = new Map(characters.map(character => [character.id, character]))
  const lines: string[] = []

  lines.push(s.docTitle)
  lines.push('')
  lines.push(s.legendLine1)
  lines.push(s.legendLine2)
  lines.push(s.legendLine3)
  lines.push(s.legendLine4)
  lines.push('')

  lines.push(s.charactersHeading(characters.length))
  characters.forEach((character, index) => {
    const meta = characterMetaLine(character.sheet, language)
    lines.push(`${index + 1}. ${character.name}${meta ? ` — ${meta}` : ''}`)
    lines.push(...characterSheetLines(character, language))
    if (character.description.trim()) {
      lines.push(`   ${cleanText(character.description)}`)
    }
  })

  lines.push('')
  lines.push(s.relationshipsHeading(relationships.length))
  if (relationships.length === 0) {
    lines.push(s.none)
  }
  relationships.forEach(relationship => {
    const from = byId.get(relationship.fromCharacterId)
    const to = byId.get(relationship.toCharacterId)
    if (!from || !to) return
    const arrow = relationship.kind === 'mutual' ? '↔' : '→'
    let line = `- ${from.name} ${arrow} ${to.name}: ${relationship.label}`
    if (relationship.description.trim()) {
      line += ` — ${cleanText(relationship.description)}`
    }
    lines.push(line)

    if (relationship.events.length > 0) {
      lines.push(`     ${s.timelineLabel}:`)
      const sortedEvents = [...relationship.events].sort((a, b) => a.year - b.year)
      for (const event of sortedEvents) {
        let eventLine = `       ${event.year} — ${event.title || s.eventFallback}`
        if (event.description?.trim()) eventLine += `: ${cleanText(event.description)}`
        if (event.active === true) eventLine += s.appearsSuffix
        else if (event.active === false) eventLine += s.disappearsSuffix
        lines.push(eventLine)
      }
    }
  })

  return lines.join('\n')
}
