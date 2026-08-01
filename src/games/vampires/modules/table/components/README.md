# Table Components

UI slices extracted from `GameTable.tsx`. Table panel shells and orchestration-heavy
modals now live under `src/games/vampires/modules/table/components/*`.

| Component | Status | Responsibility |
|---|---|---|
| `TableRoleGate` / `MasterRoleTopbar` | implemented | Password-gated master entry, player role chooser + role reset |
| `SceneManager` / `SceneLayerPanel` | implemented | Session folders, scene mode/music + layer groups |
| `OpposedRollModal` | implemented | Incoming opposed proposal + response builder |
| `WillpowerRerollControls` | implemented | Dice selection + willpower reroll in roll rail |
| `CharacterPreviewModal` | implemented | Quick character sheet (rolls, vitals, inventory) |
| `DisciplinePowerPanel` | implemented | Discipline power detail + activation/roll |
| `RollModifierControls` | implemented | Discipline roll modifier toggles |
| `VoiceControls` | planned | WebRTC voice (still in `GameTable` + `ChatPanel`) |

Do not grow `GameTable.tsx` when adding features — add or extend components under
`src/games/vampires/modules/table/components/*` instead.
