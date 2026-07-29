import { getRollsSystemAdapter } from './configure'

export function rollsDice() {
  return getRollsSystemAdapter().dice
}