# React Table Edit Protocol

Applies to: `games/vampires/modules/table/*`, `games/vampires/modules/chat/*`, and `games/vampires/modules/music/*`.

Read `../subsystems/game-table.md` first (and `music-and-media.md` /
`dice-and-rolls.md` if relevant).

## Rules
1. **Do not grow `GameTable.tsx`.** It is already ~9k lines. New sizeable behavior
   goes into a child component, a hook, or a lib module — not inline.
2. **Where things belong:**
   - UI → a component in `games/vampires/modules/table/components/*`, `games/vampires/modules/chat/components/*`,
     or `games/vampires/modules/music/components/*`.
   - Table types/constants/mappers → `games/vampires/modules/table/*` (canonical).
   - Table utils (media/layer/scene) → `games/vampires/modules/table/utils/*`.
   - VTM rules → `games/vampires/core/vtm5/rules/*` (pure).
3. **Never hardcode Supabase table/bucket names.** Import from
   `games/vampires/modules/table/constants.ts`. Changing a
   name is a schema change — see `supabase-edit-protocol.md`.
4. **Respect the room/role model.** Keep master-only actions gated; keep state
   keyed by `room`; don't leak master controls to players.
5. **Keep realtime consistent.** Subscriptions/state must stay coherent per room;
   avoid duplicate handlers and update loops.
6. **Map through `games/vampires/modules/table/mappers.ts`** for Supabase row ↔ app conversions;
   don't inline ad-hoc mapping.

## After the change — verify
1. `npm run lint` (type check) and, for non-trivial changes, `npm run build`.
2. `/table?room=campaign-666&role=master` and `...&role=player`:
   - room/role persistence,
   - a dice roll appears for both,
   - scene switching shows the right media/layers,
   - chat works,
   - the music panel plays.

## Update docs?
Only per `../UPDATE-RULES.md` — e.g. a changed table data model
(`games/vampires/modules/table/types.ts`) or a new subsystem-level behavior warrants a subsystem
doc update (and possibly a `../DECISIONS.md` entry).
