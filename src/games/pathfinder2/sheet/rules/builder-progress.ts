import type {
  Pathfinder2CharacterDraft,
  Pathfinder2StepId,
  Pathfinder2StepState,
} from '../types'

export function getBuilderStepState(
  draft: Pathfinder2CharacterDraft,
  step: Pathfinder2StepId,
): Pathfinder2StepState {
  if (step === 'concept') {
    if (draft.name.trim() && draft.concept.trim()) return 'complete'
    if (draft.name.trim() || draft.concept.trim()) return 'partial'
    return 'not-started'
  }
  if (step === 'ancestry') return draft.ancestryId ? 'complete' : 'not-started'
  if (step === 'heritage') {
    if (!draft.ancestryId) return 'error'
    return draft.heritageId ? 'complete' : 'not-started'
  }
  if (step === 'background') return draft.backgroundId ? 'complete' : 'not-started'
  if (step === 'class') {
    if (draft.classId && draft.keyAbility) return 'complete'
    return draft.classId ? 'partial' : 'not-started'
  }
  if (step === 'attributes') {
    return Object.values(draft.attributes).some(value => value !== 0)
      ? 'complete'
      : 'not-started'
  }
  if (step === 'skills') {
    return draft.trainedSkills.length > 0 ? 'complete' : 'not-started'
  }
  if (step === 'feats') {
    return draft.generalFeatIds.length + draft.skillFeatIds.length > 0
      ? 'complete'
      : 'not-started'
  }
  if (step === 'equipment') {
    if (draft.equipment.trim() && draft.languages.trim()) return 'complete'
    if (draft.equipment.trim() || draft.languages.trim()) return 'partial'
    return 'not-started'
  }

  const required = [
    draft.name,
    draft.ancestryId,
    draft.heritageId,
    draft.backgroundId,
    draft.classId,
  ]
  return required.every(Boolean) ? 'complete' : 'partial'
}

export function getBuilderCompletion(draft: Pathfinder2CharacterDraft) {
  const steps: Pathfinder2StepId[] = [
    'concept',
    'ancestry',
    'heritage',
    'background',
    'class',
    'attributes',
    'skills',
    'feats',
    'equipment',
    'review',
  ]
  const score = steps.reduce((total, step) => {
    const state = getBuilderStepState(draft, step)
    if (state === 'complete') return total + 1
    if (state === 'partial') return total + 0.5
    return total
  }, 0)
  return Math.round(score / steps.length * 100)
}
