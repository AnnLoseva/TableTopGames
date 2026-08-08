# Table Hooks

| Hook | Status | Responsibility |
|---|---|---|
| `useRoomSession` | implemented | `room` + role selection with compatibility-password verification for master entry |
| `useTableRolls` | implemented | roll history state + initial load |
| `useTableAlerts` | implemented | sound + tab-title blink on new roll/incoming chat message (see `utils/notification-alerts.ts`) |
| `useUnreadFeed` | implemented | in-app unread counter per panel (chat, rolls): history and own entries never count, clears while the panel is visible |
| `useTableScenes` | implemented | scene folders, scenes, view mode, active scene/music + bootstrap |
| `useTableLayers` | implemented | layers state + `loadLayersForScene` |
| `useTableRealtime` | implemented | Supabase channel `table-room:{room}` + `broadcast` |
| `useJournal` | planned | in-table journal entries |
| `useVoice` | planned | WebRTC voice participants |

`GameTable.tsx` still owns roll builders, health/willpower actions, voice
WebRTC setup, and master/player action handlers. Hooks extract repeatable
state + data loading + realtime.
