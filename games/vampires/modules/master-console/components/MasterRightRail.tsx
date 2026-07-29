'use client'

import { MasterRoller } from '@/games/vampires/modules/master-rolls'
import type { MasterRollRequest } from '../types'

type MasterRightRailProps = {
  room: string
  rollRequest: MasterRollRequest | null
  onClearRollRequest?: () => void
  /** Bumped when command palette asks to focus the roller. */
  focusToken?: number
}

/**
 * Permanent right rail — must not unmount when the central module changes.
 */
export default function MasterRightRail({
  room,
  rollRequest,
  onClearRollRequest,
  focusToken = 0,
}: MasterRightRailProps) {
  return (
    <aside
      className="master-right-rail"
      aria-label="Инструменты рассказчика"
      tabIndex={-1}
      data-focus-token={focusToken || undefined}
    >
      <MasterRoller
        room={room}
        rollRequest={rollRequest}
        onClearRollRequest={onClearRollRequest}
      />
    </aside>
  )
}
