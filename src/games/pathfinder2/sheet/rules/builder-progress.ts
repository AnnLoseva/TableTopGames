import type {
  Pathfinder2CharacterDraft,
  Pathfinder2StepId,
  Pathfinder2StepState,
  Pathfinder2ValidationIssue,
} from '../types'

function hasStepError(
  step: Pathfinder2StepId,
  issues: Pathfinder2ValidationIssue[],
) {
  return issues.some(issue => issue.step === step && issue.severity === 'error')
}

export function getBuilderStepState(
  draft: Pathfinder2CharacterDraft,
  step: Pathfinder2StepId,
  issues: Pathfinder2ValidationIssue[] = [],
): Pathfinder2StepState {
  if (step === 'initial-attributes') return 'complete'

  if (step === 'concept') {
    if (hasStepError(step, issues)) {
      return draft.name.trim() || draft.concept.trim() ? 'error' : 'not-started'
    }
    return draft.name.trim() && draft.concept.trim()
      ? 'complete'
      : draft.name.trim() || draft.concept.trim()
        ? 'partial'
        : 'not-started'
  }

  if (step === 'ancestry') {
    const hasHeritage = Boolean(draft.heritageId || draft.versatileHeritageId)
    if (hasStepError(step, issues)) {
      return draft.ancestryId || hasHeritage ? 'error' : 'not-started'
    }
    return draft.ancestryId && hasHeritage
      ? 'complete'
      : draft.ancestryId || hasHeritage
        ? 'partial'
        : 'not-started'
  }

  if (step === 'background') {
    if (hasStepError(step, issues)) return draft.backgroundId ? 'error' : 'not-started'
    return draft.backgroundId ? 'complete' : 'not-started'
  }

  if (step === 'class') {
    if (hasStepError(step, issues)) return draft.classId ? 'error' : 'not-started'
    return draft.classId && draft.attributeChoices.classKeyBoost
      ? 'complete'
      : draft.classId
        ? 'partial'
        : 'not-started'
  }

  if (step === 'final-attributes') {
    if (hasStepError(step, issues)) {
      return draft.attributeChoices.finalFreeBoosts.length ? 'error' : 'partial'
    }
    return draft.attributeChoices.finalFreeBoosts.length === 4
      ? 'complete'
      : 'partial'
  }

  if (step === 'features') {
    if (hasStepError(step, issues)) return draft.classId ? 'error' : 'not-started'
    return draft.classId && draft.backgroundId ? 'complete' : 'not-started'
  }

  if (step === 'equipment') {
    return hasStepError(step, issues) ? 'error' : 'complete'
  }

  if (step === 'calculations') {
    return draft.ancestryId && draft.classId ? 'complete' : 'partial'
  }

  if (step === 'details') {
    if (hasStepError(step, issues)) return 'error'
    return draft.notes.trim() || draft.languages.trim() ? 'partial' : 'not-started'
  }

  return issues.some(issue => issue.severity === 'error') ? 'error' : 'complete'
}

export function getBuilderCompletion(
  draft: Pathfinder2CharacterDraft,
  issues: Pathfinder2ValidationIssue[] = [],
) {
  const steps: Pathfinder2StepId[] = [
    'concept',
    'initial-attributes',
    'ancestry',
    'background',
    'class',
    'final-attributes',
    'features',
    'equipment',
    'calculations',
    'details',
    'review',
  ]
  const score = steps.reduce((total, step) => {
    const state = getBuilderStepState(draft, step, issues)
    if (state === 'complete') return total + 1
    if (state === 'partial') return total + 0.5
    return total
  }, 0)
  return Math.round(score / steps.length * 100)
}
