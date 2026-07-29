# Current State

> Keep this file **short and current**. It is the first thing every agent reads.
> Delete stale lines. Long-term decisions go to `DECISIONS.md`, not here.

## Current development focus
- **Pathfinder 2 full builder, staged work (2026-07-29)** — schema v4 is
  canonical and the route now uses an eleven-step builder plus unified v4
  character state. Pure engines cover attributes, skills, proficiencies,
  currency/Bulk, typed combat, spellcasting, details and sequential level-up.
  `spells.json` is connected. `catalogs/` now provides normalized canonical
  documents for equipment (1825 entries), weapons (418), armor (132), shields
  (92), deities (361), languages (23), traits (212), and class-progression
  (28 entries covering global + 27 classes 1–20). All catalogs use schemaVersion
  1 with stable IDs. Missing ancestry/class feats, complete item mechanics
  (price/Bulk/combat stats from prose) and full class-progression tables remain
  honest blockers. Normalizer script at
  `src/games/pathfinder2/scripts/normalize-rules.ts` is deterministic and
  idempotent.
- **TableTopGames portal and shared account (2026-07-29)** — `/` is the game selector, VTM lives under `/vampires/*`, and Pathfinder remains at `/pathfinder2/sheet`. The root `AccountProvider` uses the existing Vampire Supabase account, persists its session, and mirrors the profile into the legacy VTM storage keys used by the sheet, table and journal. Old root VTM URLs are compatibility redirects.
- **Game table lite (2026-07-18)** — scene stage/background on `table_scenes`,
  character tokens (`table_tokens`) above media, `table_character_controllers`
  (several characters per player), geometric player visibility (outside-stage
  hidden/clipped, own tokens always visible). Needs live-room testing with a
  logged-in master + player; server-side permission checks still impossible
  (custom users identity, permissive `table_*` RLS).
- **Master console (PROMPT 6–15)** — six modules live under `/vampires/master`: overview,
  actors, scenes, lore, blood-bonds, session-log. Search/commands (`⌘K`), deep
  links, detached second-monitor windows (`display=detached`), layout versioning.
  Route entry now requires a live Supabase Auth session plus master membership;
  the local password remains only a compatibility lock. Production provisioning
  for new chronicles/members remains operator-owned.
- **Legacy character sheet phase** — iframe sheet (`public/vampires/main.js` +
  `old-sheet.html`) stays load-bearing; bridge in `src/games/vampires/modules/character-sheet/`.
- Hub + Modules architecture is **mostly complete** (`GameTable.tsx` ~2.6k lines —
  do not grow for master features).
- Run `npm run test:vtm-parity` after health/humanity edits; `npm run test:master-console`
  for layout/deep-link/registry/privacy unit checks.

## What is stable enough
- Routes `/`, `/vampires`, `/vampires/character-sheet`, `/vampires/table`,
  `/vampires/journal`, `/vampires/reference`, `/vampires/library/chronicles`,
  `/vampires/master`, `/pathfinder2/sheet` are active. VTM wrappers live in
  `src/app/(vampires)/vampires`; former root VTM URLs redirect to them.
- The iframe character sheet loads, saves and loads characters.
- The game table renders and syncs a room via Supabase.
- `src/games/vampires/core/vtm5/rules/*` pure modules (health, humanity, damage, derived stats, disciplines).
- `src/games/vampires/modules/chat/*` owns text chat auth, message history, realtime delivery and UI.
- `src/games/vampires/modules/music/*` owns shared room music playback, adapters and
  the persistent mount in `src/app/(vampires)/vampires/layout.tsx`.
- `src/games/vampires/modules/table/*` owns table orchestrator, data layer, APIs, hooks, utils,
  panels/modals (`RollHistoryPanel`, `LayerContextMenuPanel`, `MediaPreviewModal`,
  etc.); deprecated component and `lib/table/*` shims have been removed.

## What is fragile
- `public/vampires/main.js` (~11k lines) — legacy sheet logic monolith.
- `public/vampires/old-sheet.html` (~5k lines) — legacy sheet markup/styles.
- `src/games/vampires/modules/table/GameTable.tsx` (~2.6k lines) — still wires many hooks inline.
- **Duplicated VTM logic**: `public/vampires/vtm-health.js` /
  `public/vampires/vtm-humanity.js` must stay aligned with
  `src/games/vampires/core/vtm5/rules/*` — guarded by `npm run test:vtm-parity`
  (discipline parsing in `public/vampires/main.js` is still manual).
- The **iframe bridge** between `/vampires/character-sheet` and
  `/vampires/old-sheet.html` (`/old-sheet.html` remains a compatibility alias)
  (query params, localStorage, `vtm-character-saved` postMessage).
- RU/EN trait & discipline names across `rules.json` / `rules_eng.json` / i18n.

## Active problems
_(none recorded — add temporary bugs here only while being worked, then remove;
 use `templates/bug-investigation-template.md` for the writeup)_

## Next likely tasks
- Finish subsystem documentation and keep it accurate.
- Gradually extract logic out of `public/vampires/main.js` (small steps, explicit tasks).
- Sync full sheet ↔ quick sheet representations.
- Character creation wizard improvements.
- Humanity / stains / remorse flow.
- Improve Supabase persistence robustness.

## Do not touch casually
- `public/vampires/main.js`, `public/vampires/old-sheet.html` — read `workflows/legacy-edit-protocol.md`.
- `src/games/vampires/modules/table/GameTable.tsx` — read `workflows/react-table-edit-protocol.md`.
- Supabase table/bucket names & saved-data shape — read `workflows/supabase-edit-protocol.md`.
- `public/vampires/rules.json` / `rules_eng.json` — data layer, mind RU/EN drift.

## Last updated
2026-07-29 — Extended the staged Pathfinder 2 builder through the eleven-step
v4 UI, unified rules state, equipment/spell/detail engines and sequential
level-up; remaining blockers are owner-data catalogs rather than hidden manual
fields.
  Earlier: Added the TableTopGames game selector and persistent shared account; moved canonical VTM pages to `/vampires/*` with compatibility redirects.
  Earlier: Game table lite: scene stage/background, character tokens above
  media, character controllers, geometric player visibility (see DECISIONS).
  Earlier: `/vampires/library/chronicles` now separates official history from
  owner-only, resumable AI-processed player transcripts (full clean text + short
  personal recap), and the Librarian searches both under caller RLS.
  Earlier: `/vampires/master` gates module mount on live Supabase Auth +
  `chronicle_members` and the home screen validates cached identity against the
  current Auth user. Earlier: PROMPT 14–15 detached windows (`display=detached`), BroadcastChannel
  bus, layout schema v1 + conflict copy, home → `/vampires/master` for master role,
  `test:master-console`, search/command palette, session-log. Six modules active.
  Earlier same day: bonds, lore, scenes, overview, rolls, NPC.
