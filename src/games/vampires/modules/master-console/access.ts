import type { ChronicleMembership } from './persistence/types'

export type MasterConsoleAccess =
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'allowed'; membership: ChronicleMembership }

/**
 * Pure access decision shared by the route and unit tests.
 * The local master password is deliberately not part of this authorization.
 */
export function resolveMasterConsoleAccess(
  authUserId: string | null,
  membership: ChronicleMembership | null,
): MasterConsoleAccess {
  if (!authUserId) return { status: 'signed-out' }
  if (!membership || membership.userId !== authUserId || membership.role !== 'master') {
    return { status: 'forbidden' }
  }
  return { status: 'allowed', membership }
}
