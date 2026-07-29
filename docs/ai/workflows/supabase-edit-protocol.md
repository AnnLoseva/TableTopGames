# Supabase Edit Protocol

Applies to: anything touching Supabase — `src/games/vampires/lib/supabase.ts`, `public/vampires/supabase.js`,
`src/games/vampires/modules/table/constants.ts`, `src/games/vampires/modules/table/mappers.ts`, `src/games/vampires/supabase/*.sql`, and any
`GameTable.tsx` read/write.

Read `../subsystems/supabase-persistence.md` first.

## Rules
1. **Do not rename table or bucket names casually.** They are a contract shared by
   the React table and the legacy sheet. A rename must update, together:
   - `src/games/vampires/modules/table/constants.ts`,
   - both clients (`src/games/vampires/lib/supabase.ts`, `public/vampires/supabase.js`) where relevant,
   - `src/games/vampires/modules/table/mappers.ts`,
   - `src/games/vampires/supabase/*.sql`,
   - and a `../DECISIONS.md` entry with a migration note.
2. **Do not change storage buckets** (`table-images`, the music bucket) without
   updating the SQL/policies and documenting it.
3. **Do not change the shape of saved data** (character rows, table rows) without
   a **migration note** — old saved data must still load or be migrated.
4. **Keep RLS in mind.** Policies in `src/games/vampires/supabase/*.sql` gate anon/authenticated
   access; a schema change may need a policy change (and vice versa).
5. **Record it.** Any schema/contract change goes in `../DECISIONS.md`.

## After the change — verify
1. `npm run lint` / `npm run build`.
2. **Master/player room flow:** `/table?room=campaign-666&role=master` and
   `...&role=player` — data loads, realtime updates propagate, master gating
   holds.
3. **Character save/load:** `/character-sheet` — create → save → reload → data
   persists (this exercises the `characters` table via the legacy client).

## Update docs?
Always, per `../UPDATE-RULES.md`: update
`../subsystems/supabase-persistence.md`, `../ARCHITECTURE-MAP.md` (if the table
list changes), and add a `../DECISIONS.md` entry.
