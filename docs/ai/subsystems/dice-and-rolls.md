# Dice and Rolls

## Purpose
VTM V5 dice rolls at the table: build a pool, roll, resolve successes/messy
criticals/bestial failures, apply hunger dice, and (planned) contested/opposed
rolls and rouse checks. Rolls are shared in the room and can originate from the
character sheet or the table.

## Main files
- `src/games/vampires/modules/rolls/components/DiceRollOverlay.tsx` — the roll UI / results overlay.
- `src/games/vampires/modules/rolls/utils/*` — quick/rouse/opposed/willpower builders (canonical).
- Roll state persistence: `table_rolls` (see `supabase-persistence.md`).
- `src/games/vampires/modules/master-rolls/*` — permanent `/master` right-rail roller; public rolls
  reuse `table_rolls`/`RollMessage`; hidden rolls use `master_hidden_rolls`.
- `GameTable.tsx` — wires rolls into room state and realtime.
- Mechanics live in `src/games/vampires/core/vtm5/rules/*` (successes, hunger, margins); disciplines can
  trigger rolls/costs via `src/games/vampires/core/vtm5/rules/disciplines/*`.
- Legacy sheet feeds rolls through the `vtm-table-rolls` / `vtm-table-last-roll`
  window signals (see `legacy-character-sheet.md`).

## How rolls flow
```text
pool built (sheet or table)
  → roll resolved (successes, messy crit, bestial failure, hunger dice)
  → written to table_rolls (per room)
  → broadcast via realtime → shown in DiceRollOverlay for everyone
```

## Roll types
- **Standard pool** — attribute + skill + modifiers vs difficulty; hunger dice
  substitute normal dice.
- **Rouse checks** — spend/burn blood; success/failure affects hunger.
- **Contested / opposed rolls** — two pools compared; **planned** for the normal
  roll UI (roadmap item).
- **Discipline-driven rolls** — costs/effects from `src/games/vampires/core/vtm5/rules/disciplines/*`.

## Roll rows & overlay
Each roll is a row (room, roller, pool, results, timestamp) surfaced in
`DiceRollOverlay.tsx`. Keep result computation in pure helpers (`src/games/vampires/core/vtm5/rules/*`), not
inline in the overlay or `GameTable.tsx`.

## Link to VTM mechanics & disciplines
- Success/hunger/critical logic belongs in `src/games/vampires/core/vtm5/rules/*` so it's testable.
- Discipline activations that require rolls or costs go through
  `src/games/vampires/core/vtm5/rules/disciplines/{engine,costs}.ts`.
- Damage resulting from rolls uses `src/games/vampires/core/vtm5/rules/health/index.ts` and
  `src/games/vampires/core/vtm5/rules/damage/index.ts`.

## Known risks
- Duplicated roll logic between legacy JS and `src/games/vampires/core/vtm5/rules/*`.
- Hunger dice / messy critical / bestial failure edge cases.
- Realtime duplication or ordering of `table_rolls` rows.

## Safe edit protocol
1. Read `../workflows/vtm-mechanics-edit-protocol.md` (logic) and
   `../workflows/react-table-edit-protocol.md` (UI/table wiring).
2. Put resolution logic in `src/games/vampires/core/vtm5/rules/*`; keep the overlay presentational.
3. Verify with a roll in `/table` for both master and player, and check the
   result matches VTM V5 rules.

## Related docs
`vtm-mechanics.md`, `game-table.md`, `supabase-persistence.md`,
`legacy-character-sheet.md`.
