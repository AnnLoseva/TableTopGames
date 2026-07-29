# Table Hooks

| Hook | Status | Responsibility |
|---|---|---|
| `useRoomSession` | implemented | `room`, `role`, master password gate |
| `useTableRolls` | implemented | roll history state + initial load |
| `useTableScenes` | implemented | scenes, active scene, scene music state + bootstrap |
| `useTableLayers` | implemented | layers state + `loadLayersForScene` |
| `useTableRealtime` | implemented | Supabase channel `table-room:{room}` + `broadcast` |
| `useJournal` | planned | in-table journal entries |
| `useVoice` | planned | WebRTC voice participants |

`GameTable.tsx` still owns roll builders, health/willpower actions, voice
WebRTC setup, and master/player action handlers. Hooks extract repeatable
state + data loading + realtime.