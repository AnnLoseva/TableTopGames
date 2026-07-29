import { PATHFINDER2_ATTRIBUTES } from '../../data'
import { getAncestryById } from '../../data/selectors'
import type {
  Pathfinder2AttributeBreakdownEntry,
  Pathfinder2AttributeKey,
  Pathfinder2CalculatedAttributes,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
} from '../../types'
import { ATTRIBUTE_BOOST_LEVELS } from '../progression/attribute-progression'

function emptyAttributeRecord<Value>(factory: () => Value) {
  return Object.fromEntries(
    PATHFINDER2_ATTRIBUTES.map(attribute => [attribute.key, factory()]),
  ) as Record<Pathfinder2AttributeKey, Value>
}

export function getAncestryAttributeRules(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
) {
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  if (!ancestry) {
    return {
      fixedBoosts: [] as Pathfinder2AttributeKey[],
      flaw: null as Pathfinder2AttributeKey | null,
      freeBoostCount: draft.attributeChoices.ancestryMode === 'alternate' ? 2 : 0,
    }
  }

  if (draft.attributeChoices.ancestryMode === 'alternate') {
    return {
      fixedBoosts: [] as Pathfinder2AttributeKey[],
      flaw: null as Pathfinder2AttributeKey | null,
      freeBoostCount: 2,
    }
  }

  return {
    fixedBoosts: ancestry.abilityBoosts.filter(
      (value): value is Pathfinder2AttributeKey => value !== 'free',
    ),
    flaw: ancestry.abilityFlaw as Pathfinder2AttributeKey | null,
    freeBoostCount: ancestry.abilityBoosts.filter(value => value === 'free').length,
  }
}

export function calculateAttributeModifiers(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2CalculatedAttributes {
  const modifiers = emptyAttributeRecord(() => 0)
  const breakdown = emptyAttributeRecord<Pathfinder2AttributeBreakdownEntry[]>(() => [])
  const partialBoosts = emptyAttributeRecord(() => 0)
  const ancestryRules = getAncestryAttributeRules(draft, catalog)

  const apply = (
    key: Pathfinder2AttributeKey,
    entry: Omit<Pathfinder2AttributeBreakdownEntry, 'delta' | 'partial'>,
    delta = 1,
  ) => {
    modifiers[key] += delta
    breakdown[key].push({ ...entry, delta, partial: false })
  }

  ancestryRules.fixedBoosts.forEach(key => apply(key, {
    source: 'ancestry',
    sourceLabel: 'Народ · фиксированное повышение',
    automatic: true,
  }))
  if (ancestryRules.flaw) {
    apply(ancestryRules.flaw, {
      source: 'ancestry',
      sourceLabel: 'Народ · недостаток',
      automatic: true,
    }, -1)
  }
  draft.attributeChoices.ancestryFreeBoosts.forEach(key => apply(key, {
    source: 'ancestry',
    sourceLabel: draft.attributeChoices.ancestryMode === 'alternate'
      ? 'Народ · альтернативное повышение'
      : 'Народ · свободное повышение',
    automatic: false,
  }))
  draft.attributeChoices.voluntaryFlaws.forEach(key => apply(key, {
    source: 'voluntary-flaw',
    sourceLabel: 'Народ · добровольное понижение',
    automatic: false,
  }, -1))

  if (draft.attributeChoices.backgroundLimitedBoost) {
    apply(draft.attributeChoices.backgroundLimitedBoost, {
      source: 'background',
      sourceLabel: 'Предыстория · ограниченное повышение',
      automatic: false,
    })
  }
  if (draft.attributeChoices.backgroundFreeBoost) {
    apply(draft.attributeChoices.backgroundFreeBoost, {
      source: 'background',
      sourceLabel: 'Предыстория · свободное повышение',
      automatic: false,
    })
  }
  if (draft.attributeChoices.classKeyBoost) {
    apply(draft.attributeChoices.classKeyBoost, {
      source: 'class',
      sourceLabel: 'Класс · ключевая характеристика',
      automatic: false,
    })
  }
  draft.attributeChoices.finalFreeBoosts.forEach(key => apply(key, {
    source: 'free',
    sourceLabel: 'Четыре свободных повышения',
    automatic: false,
  }))

  ATTRIBUTE_BOOST_LEVELS.forEach(level => {
    if (draft.level < level) return
    draft.attributeChoices.levelBoosts[level].forEach(key => {
      if (modifiers[key] < 4) {
        apply(key, {
          source: 'level',
          sourceLabel: `${level}-й уровень · полное повышение`,
          automatic: false,
        })
        return
      }
      if (partialBoosts[key] === 0) {
        partialBoosts[key] = 1
        breakdown[key].push({
          source: 'level',
          sourceLabel: `${level}-й уровень · частичное повышение`,
          delta: 0,
          automatic: false,
          partial: true,
        })
        return
      }
      partialBoosts[key] = 0
      apply(key, {
        source: 'level',
        sourceLabel: `${level}-й уровень · завершённое частичное повышение`,
        automatic: false,
      })
    })
  })

  return { modifiers, breakdown, partialBoosts }
}
