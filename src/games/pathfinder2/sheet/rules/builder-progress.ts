import type {
  Pathfinder2CharacterDraft,
  Pathfinder2StepId,
  Pathfinder2StepState,
  Pathfinder2ValidationIssue,
} from '../types'

export function getBuilderStepState(
  draft: Pathfinder2CharacterDraft,
  step: Pathfinder2StepId,
  issues: Pathfinder2ValidationIssue[] = [],
): Pathfinder2StepState {
  const stepIssues = issues.filter(issue => (
    issue.step === step && issue.severity === 'error'
  ))
  if (stepIssues.length > 0) {
    const hasAnyValue = step === 'attributes'
      ? draft.attributeChoices.ancestryFreeBoosts.length
        + draft.attributeChoices.finalFreeBoosts.length > 0
      : step === 'skills'
        ? draft.skillChoices.classFreeSkills.length
          + draft.skillChoices.intelligenceSkills.length > 0
        : true
    return hasAnyValue ? 'error' : 'not-started'
  }
  if (step === 'concept') {
    if (draft.name.trim() && draft.concept.trim()) return 'complete'
    if (draft.name.trim() || draft.concept.trim()) return 'partial'
    return 'not-started'
  }
  if (step === 'ancestry') return draft.ancestryId ? 'complete' : 'not-started'
  if (step === 'heritage') {
    if (!draft.ancestryId) return 'error'
    return draft.heritageId || draft.versatileHeritageId ? 'complete' : 'not-started'
  }
  if (step === 'background') return draft.backgroundId ? 'complete' : 'not-started'
  if (step === 'class') {
    if (draft.classId && draft.attributeChoices.classKeyBoost) return 'complete'
    return draft.classId ? 'partial' : 'not-started'
  }
  if (step === 'attributes') {
    return draft.attributeChoices.finalFreeBoosts.length === 4
      ? 'complete'
      : 'partial'
  }
  if (step === 'skills') {
    return draft.classId && draft.backgroundId ? 'complete' : 'not-started'
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

  return issues.some(issue => issue.severity === 'error') ? 'error' : 'complete'
}

export function getBuilderCompletion(
  draft: Pathfinder2CharacterDraft,
  issues: Pathfinder2ValidationIssue[] = [],
) {
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
    const state = getBuilderStepState(draft, step, issues)
    if (state === 'complete') return total + 1
    if (state === 'partial') return total + 0.5
    return total
  }, 0)
  return Math.round(score / steps.length * 100)
}
