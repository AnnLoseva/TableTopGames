import { createVtm5SystemCore } from '@/games/vampires/core/vtm5'
import { chatModuleDefinition } from '@/games/vampires/modules/chat/module-definition'
import { characterSheetModuleDefinition } from '@/games/vampires/modules/character-sheet/module-definition'
import { homeModuleDefinition } from '@/games/vampires/modules/home/module-definition'
import { journalModuleDefinition } from '@/games/vampires/modules/journal/module-definition'
import { musicModuleDefinition } from '@/games/vampires/modules/music/module-definition'
import { masterConsoleModuleDefinition } from '@/games/vampires/modules/master-console/module-definition'
import { masterRollsModuleDefinition } from '@/games/vampires/modules/master-rolls/module-definition'
import { masterOverviewModuleDefinition } from '@/games/vampires/modules/master-overview/module-definition'
import { masterScenesModuleDefinition } from '@/games/vampires/modules/master-scenes/module-definition'
import { loreModuleDefinition } from '@/games/vampires/modules/lore/module-definition'
import { bloodBondsModuleDefinition } from '@/games/vampires/modules/blood-bonds/module-definition'
import { sessionLogModuleDefinition } from '@/games/vampires/modules/session-log/module-definition'
import { actorsModuleDefinition } from '@/games/vampires/modules/actors/module-definition'
import { referenceModuleDefinition } from '@/games/vampires/modules/reference/module-definition'
import { rollsModuleDefinition } from '@/games/vampires/modules/rolls/module-definition'
import { tableModuleDefinition } from '@/games/vampires/modules/table/module-definition'
import { createChronicleHub } from '@/platform/hub'
import type { ChronicleHub } from '@/platform/hub'

/** Hub preloaded with VTM5 and the core VTM5 feature modules. */
export function createVtm5ChronicleHub(): ChronicleHub {
  const vtm5 = createVtm5SystemCore()

  return createChronicleHub({
    systems: [vtm5.system],
    modules: [
      { module: homeModuleDefinition, enabledByDefault: true },
      { module: tableModuleDefinition, enabledByDefault: true },
      { module: chatModuleDefinition, enabledByDefault: true },
      { module: musicModuleDefinition, enabledByDefault: true },
      { module: masterConsoleModuleDefinition, enabledByDefault: true },
      { module: masterRollsModuleDefinition, enabledByDefault: true },
      { module: masterOverviewModuleDefinition, enabledByDefault: true },
      { module: masterScenesModuleDefinition, enabledByDefault: true },
      { module: loreModuleDefinition, enabledByDefault: true },
      { module: bloodBondsModuleDefinition, enabledByDefault: true },
      { module: sessionLogModuleDefinition, enabledByDefault: true },
      { module: actorsModuleDefinition, enabledByDefault: true },
      { module: rollsModuleDefinition, enabledByDefault: true },
      { module: characterSheetModuleDefinition, enabledByDefault: true },
      { module: journalModuleDefinition, enabledByDefault: true },
      { module: referenceModuleDefinition, enabledByDefault: true },
    ],
  })
}
