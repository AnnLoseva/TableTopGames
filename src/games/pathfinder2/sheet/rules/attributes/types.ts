export type {
  Pathfinder2AttributeBreakdownEntry,
  Pathfinder2AttributeChoices,
  Pathfinder2AttributeKey,
  Pathfinder2AttributeMode,
  Pathfinder2CalculatedAttributes,
} from '../../types'

export type Pathfinder2AttributeChoiceStage =
  | 'ancestry'
  | 'background-limited'
  | 'background-free'
  | 'class'
  | 'final'

export type Pathfinder2AttributeChoiceOption = {
  key: import('../../types').Pathfinder2AttributeKey
  disabled: boolean
  reason?: string
}
