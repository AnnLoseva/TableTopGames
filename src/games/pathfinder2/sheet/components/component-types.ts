import type {
  Pathfinder2CharacterDraft,
  Pathfinder2ChoiceKind,
} from '../types'

export type ChoiceDialogOptions = {
  readOnly?: boolean
}

export type OpenPathfinder2Choice = (
  kind: Pathfinder2ChoiceKind,
  options?: ChoiceDialogOptions,
  trigger?: HTMLElement | null,
) => void

export type UpdatePathfinder2Character = (
  updater: (
    current: Pathfinder2CharacterDraft,
  ) => Pathfinder2CharacterDraft,
  options?: { immediate?: boolean },
) => void

export type UpdatePathfinder2Field = <
  Key extends keyof Pathfinder2CharacterDraft,
>(
  key: Key,
  value: Pathfinder2CharacterDraft[Key],
  options?: { immediate?: boolean },
) => void
