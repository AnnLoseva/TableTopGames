import type { Dispatch, SetStateAction } from 'react'

export type RollAttributeActionsDeps = {
  masterRollAttribute: string
  masterRollAttributeTwo: string
  previewRollAttribute: string
  previewRollAttributeTwo: string
  setMasterRollAttribute: Dispatch<SetStateAction<string>>
  setMasterRollAttributeTwo: Dispatch<SetStateAction<string>>
  setPreviewRollAttribute: Dispatch<SetStateAction<string>>
  setPreviewRollAttributeTwo: Dispatch<SetStateAction<string>>
}

export function createRollAttributeActions(deps: RollAttributeActionsDeps) {
  const toggleMasterRollAttribute = (name: string) => {
    if (deps.masterRollAttribute === name) {
      deps.setMasterRollAttribute('')
      return
    }
    if (deps.masterRollAttributeTwo === name) {
      deps.setMasterRollAttributeTwo('')
      return
    }
    if (!deps.masterRollAttribute) deps.setMasterRollAttribute(name)
    else deps.setMasterRollAttributeTwo(name)
  }

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
    toggleMasterRollAttribute,
    togglePreviewAttribute,
  }
}