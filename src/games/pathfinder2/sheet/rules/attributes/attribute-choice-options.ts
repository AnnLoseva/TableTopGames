import { PATHFINDER2_ATTRIBUTES } from '../../data'
import {
  getBackgroundById,
  getClassById,
} from '../../data/selectors'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
} from '../../types'
import { getAncestryAttributeRules } from './calculate-attributes'
import type {
  Pathfinder2AttributeChoiceOption,
  Pathfinder2AttributeChoiceStage,
} from './types'

export function getAttributeChoiceOptions(
  draft: Pathfinder2CharacterDraft,
  catalog: Pathfinder2RulesCatalog,
  stage: Pathfinder2AttributeChoiceStage,
): Pathfinder2AttributeChoiceOption[] {
  const ancestryRules = getAncestryAttributeRules(draft, catalog)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)

  return PATHFINDER2_ATTRIBUTES.map(({ key }) => {
    let disabled = false
    let reason: string | undefined

    if (stage === 'ancestry') {
      disabled = ancestryRules.fixedBoosts.includes(key)
        || draft.attributeChoices.ancestryFreeBoosts.includes(key)
      reason = ancestryRules.fixedBoosts.includes(key)
        ? 'Эта характеристика уже повышена фиксированным правилом народа.'
        : disabled
          ? 'Эта характеристика уже получила повышение на этапе народа.'
          : undefined
    } else if (stage === 'background-limited') {
      disabled = !background?.abilityBoostOptions.includes(key)
      reason = disabled ? 'Предыстория не разрешает это ограниченное повышение.' : undefined
    } else if (stage === 'background-free') {
      disabled = draft.attributeChoices.backgroundLimitedBoost === key
      reason = disabled
        ? 'Оба повышения предыстории должны применяться к разным характеристикам.'
        : undefined
    } else if (stage === 'class') {
      disabled = !characterClass?.keyAbilities.includes(key)
      reason = disabled ? 'Эта характеристика не является ключевой для выбранного класса.' : undefined
    } else {
      disabled = draft.attributeChoices.finalFreeBoosts.includes(key)
      reason = disabled
        ? 'Эта характеристика уже получила одно из четырёх свободных повышений.'
        : undefined
    }

    return { key, disabled, ...(reason ? { reason } : {}) }
  })
}

export function toggleAttributeChoice(
  choices: Pathfinder2AttributeKey[],
  key: Pathfinder2AttributeKey,
  limit: number,
) {
  if (choices.includes(key)) return choices.filter(value => value !== key)
  if (choices.length >= limit) return choices
  return [...choices, key]
}
