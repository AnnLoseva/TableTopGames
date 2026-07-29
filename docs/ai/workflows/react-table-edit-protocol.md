# React Table Edit Protocol

Applies to: `src/games/vampires/modules/table/*`, `src/games/vampires/modules/chat/*`, and `src/games/vampires/modules/music/*`.

Read `../subsystems/game-table.md` first (and `music-and-media.md` /
`dice-and-rolls.md` if relevant).

## Rules
1. **Do not grow `GameTable.tsx`.** It is already ~9k lines. New sizeable behavior
   goes into a child component, a hook, or a lib module — not inline.
2. **Where things belong:**
   - UI → a component in `src/games/vampires/modules/table/components/*`, `src/games/vampires/modules/chat/components/*`,
     or `src/games/vampires/modules/music/components/*`.
   - Table types/constants/mappers → `src/games/vampires/modules/table/*` (canonical).
   - Table utils (media/layer/scene) → `src/games/vampires/modules/table/utils/*`.
   - VTM rules → `src/games/vampires/core/vtm5/rules/*` (pure).
3. **Never hardcode Supabase table/bucket names.** Import from
   `src/games/vampires/modules/table/constants.ts`. Changing a
   name is a schema change — see `supabase-edit-protocol.md`.
4. **Respect the room/role model.** Keep master-only actions gated; keep state
   keyed by `room`; don't leak master controls to players.
5. **Keep realtime consistent.** Subscriptions/state must stay coherent per room;
   avoid duplicate handlers and update loops.
6. **Map through `src/games/vampires/modules/table/mappers.ts`** for Supabase row ↔ app conversions;
   don't inline ad-hoc mapping.

## After the change — verify
1. `npm run lint` (type check) and, for non-trivial changes, `npm run build`.
2. `/vampires/table?room=campaign-666&role=master` and `...&role=player`:
   - room/role persistence,
   - a dice roll appears for both,
   - scene switching shows the right media/layers,
   - chat works,
   - the music panel plays.

## Update docs?
Only per `../UPDATE-RULES.md` — e.g. a changed table data model
(`src/games/vampires/modules/table/types.ts`) or a new subsystem-level behavior warrants a subsystem
doc update (and possibly a `../DECISIONS.md` entry).
