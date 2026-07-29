import {
  bootstrapChronicleRuntime,
  createVtm5ChronicleHub,
} from '@/games/vampires/core'
import type { ChronicleRuntime } from '@/games/vampires/core'

const masterConsoleHub = createVtm5ChronicleHub()

export function bootstrapMasterConsoleForRoom(room: string): ChronicleRuntime<'vtm5'> {
  const runtime = bootstrapChronicleRuntime(masterConsoleHub, {
    id: `room:${room}`,
    name: room,
    systemId: 'vtm5',
    roomId: room,
  }) as ChronicleRuntime<'vtm5'>

  if (!runtime.resolved.modules.some(module => module.id === 'master-console')) {
    throw new Error('Master console module is not registered for VTM5')
  }

  return runtime
}
