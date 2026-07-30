import { getClassById } from '../../data/selectors'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CalculatedSpellcasting,
  Pathfinder2CharacterDraftV4,
  Pathfinder2RulesCatalog,
  Pathfinder2SpellRule,
  Pathfinder2SpellTradition,
  Pathfinder2SpellcastingEntry,
  Pathfinder2SpellcastingMode,
  Pathfinder2ValidationIssue,
} from '../../types'
import { getProficiencyBonus } from '../skills/proficiency'

const CLASS_CASTING_MODES: Record<string, Pathfinder2SpellcastingMode> = {
  animist: 'prepared',
  bard: 'spontaneous',
  champion: 'focus-only',
  cleric: 'prepared',
  druid: 'prepared',
  oracle: 'spontaneous',
  sorcerer: 'spontaneous',
  witch: 'prepared',
  wizard: 'spellbook-prepared',
}

export function normalizeSpellTradition(
  value: string | null,
): Pathfinder2SpellTradition | null {
  const normalized = (value ?? '').trim().toLocaleLowerCase('ru')
  if (normalized.includes('мистическ') || normalized.includes('аркан')) return 'arcane'
  if (normalized.includes('сакральн') || normalized.includes('божествен')) return 'divine'
  if (normalized.includes('оккульт')) return 'occult'
  if (normalized.includes('первобыт') || normalized.includes('первород')) return 'primal'
  return null
}

export function getSpellSlotsAtLevel(
  schedule: Record<string, number[]> | null,
  level: number,
) {
  if (!schedule) return { cantripSlots: 0, spellSlots: {} as Record<number, number> }
  const scheduleLevel = Object.keys(schedule)
    .map(Number)
    .filter(entryLevel => entryLevel <= level)
    .sort((left, right) => right - left)[0]
  const values = schedule[String(scheduleLevel)] ?? []
  return {
    cantripSlots: Math.max(0, Math.round(values[0] ?? 0)),
    spellSlots: Object.fromEntries(values
      .slice(1)
      .map((count, index) => [index + 1, Math.max(0, Math.round(count))])
      .filter(([, count]) => count > 0)),
  }
}

export function createClassSpellcastingEntry(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2SpellcastingEntry | null {
  const characterClass = getClassById(catalog, draft.class.classId)
  if (!characterClass?.spellTradition) return null
  const tradition = normalizeSpellTradition(characterClass.spellTradition)
  const mode = CLASS_CASTING_MODES[characterClass.id]
    ?? (characterClass.spellSlots ? 'prepared' : 'focus-only')
  const castingAttribute = draft.class.keyAbility
    && characterClass.keyAbilities.includes(draft.class.keyAbility)
    ? draft.class.keyAbility
    : characterClass.keyAbilities.length === 1
      ? characterClass.keyAbilities[0]
      : null
  if (!tradition || !castingAttribute) return null
  const slots = getSpellSlotsAtLevel(
    characterClass.spellSlots,
    draft.progression.level,
  )
  return {
    id: `class:${characterClass.id}:spellcasting`,
    source: {
      type: 'class',
      id: characterClass.id,
      label: `Класс · ${characterClass.name}`,
      level: 1,
    },
    tradition,
    mode,
    castingAttribute,
    proficiencyRank: 'trained',
    cantripSlots: slots.cantripSlots,
    spellSlots: slots.spellSlots,
    repertoireSpellIds: {},
    preparedSpellIds: {},
    spellbookSpellIds: [],
    focusSpellIds: [],
    focusPoints: mode === 'focus-only' ? 1 : 0,
  }
}

function allSpells(catalog: Pathfinder2RulesCatalog) {
  return new Map([
    ...catalog.spells,
    ...catalog.cantrips,
    ...catalog.focusSpells,
  ].map(spell => [spell.id, spell]))
}

export function isSpellAvailable(
  spell: Pathfinder2SpellRule,
  tradition: Pathfinder2SpellTradition,
  rank: number,
) {
  return spell.level <= rank
    && spell.traditions.includes(tradition)
}

function selectionIssues(
  entry: Pathfinder2SpellcastingEntry,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ValidationIssue[] {
  const issues: Pathfinder2ValidationIssue[] = []
  const spells = allSpells(catalog)
  const levelEntries = entry.mode === 'spontaneous' || entry.mode === 'bounded'
    ? entry.repertoireSpellIds
    : entry.preparedSpellIds
  const selections = Object.entries(levelEntries)

  const addCountIssue = (rank: number, count: number, expected: number) => {
    if (count === expected) return
    issues.push({
      id: `spellcasting.${entry.id}.count.${rank}`,
      severity: 'error',
      step: 'features',
      section: 'spellcasting',
      field: `rank.${rank}`,
      message: `Круг ${rank === 0 ? 'фокусов' : rank}: выбрано ${count} из ${expected}.`,
    })
  }

  const cantripSelectionCount = levelEntries[0]?.filter(Boolean).length ?? 0
  if (entry.cantripSlots > 0) {
    addCountIssue(0, cantripSelectionCount, entry.cantripSlots)
  }
  Object.entries(entry.spellSlots).forEach(([rank, count]) => {
    const selected = levelEntries[Number(rank)]?.filter(Boolean).length ?? 0
    addCountIssue(Number(rank), selected, count)
  })

  selections.forEach(([rawRank, rawIds]) => {
    const rank = Number(rawRank)
    rawIds.filter(Boolean).forEach(spellId => {
      const spell = spells.get(spellId as string)
      if (!spell) {
        issues.push({
          id: `spellcasting.${entry.id}.missing.${spellId}`,
          severity: 'error',
          step: 'features',
          section: 'spellcasting',
          field: `rank.${rank}`,
          message: `Заклинание «${spellId}» отсутствует в каталоге.`,
        })
      } else if (
        !isSpellAvailable(spell, entry.tradition, Math.max(1, rank))
        || (rank === 0 && spell.type === 'spell')
        || (rank > 0 && spell.type !== 'spell')
      ) {
        issues.push({
          id: `spellcasting.${entry.id}.illegal.${spellId}.${rank}`,
          severity: 'error',
          step: 'features',
          section: 'spellcasting',
          field: `rank.${rank}`,
          message: `«${spell.name}» недоступно для этого круга или традиции.`,
        })
      }
    })
  })

  entry.focusSpellIds.forEach(spellId => {
    const spell = spells.get(spellId)
    if (!spell || spell.type !== 'focus') {
      issues.push({
        id: `spellcasting.${entry.id}.focus.${spellId}`,
        severity: 'error',
        step: 'features',
        section: 'spellcasting',
        message: `Фокусное заклинание «${spellId}» не найдено.`,
      })
    }
  })

  if (entry.mode === 'spellbook-prepared') {
    const prepared = Object.values(entry.preparedSpellIds).flat().filter(Boolean)
    const book = new Set(entry.spellbookSpellIds)
    prepared.forEach(spellId => {
      if (spellId && !book.has(spellId)) {
        issues.push({
          id: `spellcasting.${entry.id}.spellbook.${spellId}`,
          severity: 'error',
          step: 'features',
          section: 'spellcasting',
          message: `Подготовленное заклинание «${spellId}» отсутствует в книге.`,
        })
      }
    })
  }
  return issues
}

function expectedSpellcastingIssue(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ValidationIssue | null {
  const characterClass = getClassById(catalog, draft.class.classId)
  if (!characterClass?.spellTradition) return null
  const dynamicTradition = !normalizeSpellTradition(characterClass.spellTradition)
  return {
    id: dynamicTradition
      ? `spellcasting.${characterClass.id}.tradition-choice`
      : `spellcasting.${characterClass.id}.required`,
    severity: 'error',
    step: 'features',
    section: 'spellcasting',
    message: dynamicTradition
      ? `Традиция класса «${characterClass.name}» зависит от специализации; в данных нужен структурированный выбор традиции.`
      : `Инициализируйте заклинательство класса «${characterClass.name}».`,
  }
}

export function calculateSpellcasting(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
  attributes: Record<Pathfinder2AttributeKey, number>,
): Pathfinder2CalculatedSpellcasting {
  const characterClass = getClassById(catalog, draft.class.classId)
  const expected = Boolean(characterClass?.spellTradition)
  const canInitialize = Boolean(createClassSpellcastingEntry(draft, catalog))
  const missingIssue = expected && draft.spellcasting.entries.length === 0
    ? expectedSpellcastingIssue(draft, catalog)
    : null
  const entries = draft.spellcasting.entries.map(entry => {
    const proficiency = getProficiencyBonus(
      entry.proficiencyRank,
      draft.progression.level,
    )
    const issues = selectionIssues(entry, catalog)
    return {
      entry,
      spellAttack: proficiency + attributes[entry.castingAttribute],
      spellDc: 10 + proficiency + attributes[entry.castingAttribute],
      spellSlots: { ...entry.spellSlots },
      selectedSpellIds: Array.from(new Set([
        ...Object.values(entry.repertoireSpellIds).flat(),
        ...Object.values(entry.preparedSpellIds).flat().filter(
          (id): id is string => Boolean(id),
        ),
        ...entry.spellbookSpellIds,
        ...entry.focusSpellIds,
      ])),
      issues,
    }
  })
  const issues = [
    ...(missingIssue ? [missingIssue] : []),
    ...entries.flatMap(entry => entry.issues),
  ]
  return { entries, expected, canInitialize, issues }
}
