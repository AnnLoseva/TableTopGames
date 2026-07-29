import {
  bootstrapChronicleRuntime,
  createVtm5ChronicleHub,
} from '@/games/vampires/core'
import type { ChronicleRuntime } from '@/games/vampires/core'

const tableHub = createVtm5ChronicleHub()

/** Bootstrap VTM5 adapters for a campaign table room. Idempotent per page load. */
export function bootstrapTableForRoom(room: string): ChronicleRuntime<'vtm5'> {
  return bootstrapChronicleRuntime(tableHub, {
    id: `room:${room}`,
    name: room,
    systemId: 'vtm5',
    roomId: room,
  }) as ChronicleRuntime<'vtm5'>
}
