import { VOTED_STORAGE_PREFIX } from '../constants'

function storageKey(slug: string) {
  return `${VOTED_STORAGE_PREFIX}${slug}`
}

export function getVotedResponseId(slug: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey(slug))
  } catch {
    return null
  }
}

export function markVoted(slug: string, responseId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(slug), responseId)
  } catch {
    // Private browsing / storage disabled — voting still works, just not "remembered".
  }
}
