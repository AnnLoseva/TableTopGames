import type { TableRole } from '../types'
import { MASTER_PASSWORD_KEY } from '../constants'

const DEFAULT_MASTER_PASSWORD = '1234'

export function getRoomFromLocation() {
  if (typeof window === 'undefined') return 'campaign-666'
  return new URLSearchParams(window.location.search).get('room')
    || window.localStorage.getItem('vtm-table-room')
    || 'campaign-666'
}

export function getRoleFromLocation(): TableRole | null {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'master' || role === 'player' ? role : null
}

export function rememberRoom(room: string) {
  window.localStorage.setItem('vtm-table-room', room)
}

export function rememberTableRole(role: TableRole) {
  window.localStorage.setItem('vtm-table-role', role)
}

export function clearTableRole() {
  window.localStorage.removeItem('vtm-table-role')
}

export function getStoredMasterPassword() {
  if (typeof window === 'undefined') return DEFAULT_MASTER_PASSWORD
  return window.localStorage.getItem(MASTER_PASSWORD_KEY) || DEFAULT_MASTER_PASSWORD
}

export function verifyMasterPassword(candidate: string) {
  return candidate === getStoredMasterPassword()
}
