# Table Components

UI slices extracted from `GameTable.tsx`. Table panel shells and orchestration-heavy
modals now live under `games/vampires/modules/table/components/*`.

| Component | Status | Responsibility |
|---|---|---|
| `MasterPasswordGate` / `MasterRoleTopbar` | implemented | Role gate + topbar password controls |
| `OpposedRollModal` | implemented | Incoming opposed proposal + response builder |
| `WillpowerRerollControls` | implemented | Dice selection + willpower reroll in roll rail |
| `CharacterPreviewModal` | implemented | Quick character sheet (rolls, vitals, inventory) |
| `DisciplinePowerPanel` | implemented | Discipline power detail + activation/roll |
| `RollModifierControls` | implemented | Discipline roll modifier toggles |
| `VoiceControls` | planned | WebRTC voice (still in `GameTable` + `ChatPanel`) |

Do not grow `GameTable.tsx` when adding features — add or extend components under
`games/vampires/modules/table/components/*` instead.
