import type { MapCharacter, MapRelationship } from './types'

function cleanText(value: string): string {
  return value.trim().replace(/\s*\n+\s*/g, ' ')
}

function characterMetaLine(character: MapCharacter): string {
  const sheet = character.sheet
  const parts = [
    sheet.concept,
    sheet.clan,
    sheet.generation ? `поколение ${sheet.generation}` : '',
    sheet.predatorType,
    sheet.sire ? `сир: ${sheet.sire}` : '',
  ].map(part => part.trim()).filter(Boolean)
  return parts.join(', ')
}

/**
 * Plain-text dump of the map for pasting into a chat with an AI (or anyone
 * else) that can't see the visual canvas — states every character and every
 * relationship, with an explicit legend for the arrow notation up front.
 */
export function exportCharactersMapToText(characters: MapCharacter[], relationships: MapRelationship[]): string {
  const byId = new Map(characters.map(character => [character.id, character]))
  const lines: string[] = []

  lines.push('КАРТА ПЕРСОНАЖЕЙ — текстовый экспорт')
  lines.push('')
  lines.push('Обозначения: «A → B: X» — отношение X направлено от A к B (может быть')
  lines.push('другим в обратную сторону). «A ↔ B: X» — общее/взаимное отношение X,')
  lines.push('одинаковое в обе стороны. У одной пары персонажей может быть сразу')
  lines.push('несколько отношений.')
  lines.push('')

  lines.push(`ПЕРСОНАЖИ (${characters.length}):`)
  characters.forEach((character, index) => {
    const meta = characterMetaLine(character)
    lines.push(`${index + 1}. ${character.name}${meta ? ` — ${meta}` : ''}`)
    if (character.description.trim()) {
      lines.push(`   ${cleanText(character.description)}`)
    }
  })

  lines.push('')
  lines.push(`ОТНОШЕНИЯ (${relationships.length}):`)
  if (relationships.length === 0) {
    lines.push('(нет)')
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
  })

  return lines.join('\n')
}
