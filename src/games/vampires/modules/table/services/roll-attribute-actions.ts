import type { Dispatch, SetStateAction } from 'react'

export type RollAttributeActionsDeps = {
  previewRollAttribute: string
  previewRollAttributeTwo: string
  setPreviewRollAttribute: Dispatch<SetStateAction<string>>
  setPreviewRollAttributeTwo: Dispatch<SetStateAction<string>>
}

export function createRollAttributeActions(deps: RollAttributeActionsDeps) {
  const togglePreviewAttribute = (name: string) => {
    if (deps.previewRollAttribute === name) {
      deps.setPreviewRollAttribute('')
      return
    }
    if (deps.previewRollAttributeTwo === name) {
      deps.setPreviewRollAttributeTwo('')
      return
    }
    if (!deps.previewRollAttribute) deps.setPreviewRollAttribute(name)
    else deps.setPreviewRollAttributeTwo(name)
  }

  return {
    togglePreviewAttribute,
  }
}