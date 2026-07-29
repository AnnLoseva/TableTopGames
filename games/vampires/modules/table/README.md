# Table Module

Module boundary for the shared campaign table: scenes, layers, canvas, media,
rolls, characters-at-table, and room orchestration.

## Current state (2026-07-02)

### Data layer (canonical)
- `types.ts`, `constants.ts`, `constants/roll-traits.ts`, `mappers.ts`
- `utils/*` — scene, layer, media, room-session, dice-display, roll-utils

### API (`api/*`)
- `scene-api.ts` — scenes + scene music Supabase I/O
- `layer-api.ts` — layers + storage I/O
- `roll-api.ts` — roll history insert/update
- `character-api.ts` — `characters` fetch/update

### Hooks (`hooks/*`) — wired in `GameTable.tsx`
- `useRoomSession` — room, role, master password
- `useTableRolls` — roll history state
- `useTableScenes` — scenes, active scene, scene music
- `useTableLayers` — layers + `loadLayersForScene`
- `useTableRealtime` — Supabase channel `table-room:{room}` + broadcast

### Components (`components/*`) — wired in `GameTable.tsx`
- `MasterPasswordGate`, `MasterRoleTopbar`
- `OpposedRollModal`, `WillpowerRerollControls`
- `CharacterPreviewModal`, `DisciplinePowerPanel`
- `RollModifierControls`

Runtime orchestration (roll builders, health/willpower actions, voice WebRTC,
layer drag, master panel) still lives in `games/vampires/modules/table/GameTable.tsx`
(~7.4k lines, down from ~9k). Chat and music are separate modules.

## Responsibility zones still in GameTable

| Zone | Future slice |
|---|---|
| Voice (WebRTC) | `hooks/useVoice` |
| In-table journal | `hooks/useJournal` |
| Master reveals / whispers | `api/master-api` (future) |
| Roll rail meta / opposed display | `components/RollHistoryCard` (future) |
| Layer drag / canvas orchestration | stays near `TableCanvas` |

## Import guide

```ts
import { TABLE_SCENES, mapSceneRow, useTableScenes, CharacterPreviewModal } from '@/games/vampires/modules/table'
import type { TableScene, RollMessage } from '@/games/vampires/modules/table'
```

VTM mechanics: `games/vampires/core/vtm5/rules/*` (pure, framework-independent).
