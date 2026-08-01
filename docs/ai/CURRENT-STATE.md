# Current State

> Keep this file **short and current**. It is the first thing every agent reads.
> Delete stale lines. Long-term decisions go to `DECISIONS.md`, not here.

## Current development focus
- **D&D journal, new domain (2026-07-31)** — `/dnd/journal` (`src/games/dnd/journal/*`)
  is a new isolated game domain, live against Supabase (`dnd_journal_pages`,
  `dnd_journal_folders`, `dnd_journal_images`, public `dnd-journal-images`
  bucket; migrations applied). It uses the same pages and nested folders as
  the RenaCompanion iPad app; both directions sync automatically. The route
  mirrors the app's three-panel journal shell: section/folder tree, page list,
  and reading/editing pane.
  Access is single-editor, public read: **no login is required to read the
  journal**, only one hardcoded owner Auth user id can write (RLS-enforced;
  UI hides write controls via `isEditor`, which is `false` for guests). See
  `DECISIONS.md` for the full contract. `folderId`/`sortOrder` now round-trip;
  structured entry fields remain app-local.
  **Wiki + images (same day):** reading view understands app markup
  `[[Page]]` (navigable / broken-link create) and `![[Image name]]`
  (full-width on its own line, inline otherwise) via
  `wiki-markup.ts` + `JournalWikiBody.tsx`. All journal images are loaded
  for global name resolution; gallery can insert/copy embeds.
  **Sync fix (same day):** the iPad app's sync had two bugs — a `user_id`
  filter that hid every site-created page/folder from the app, and the
  paragraph merge running unconditionally instead of only on a real
  conflict, which resurrected text deleted on the site. Both fixed app-side
  (`DnD Interactive Sheet` repo); see `DECISIONS.md`. Needs the owner to
  rebuild/reinstall the app and confirm live.
  **RLS fix (same day, live migration):** pages'/images' soft-delete
  (`UPDATE ... deleted_at`) and image uploads to `storage.objects` were
  *unconditionally* failing RLS since these tables were created — Postgres
  requires the post-write row to also satisfy an applicable SELECT policy,
  and neither had one that survived a soft-delete, nor did the images bucket
  have any SELECT policy at all. Fixed live (migration
  `dnd_journal_fix_soft_delete_select_policies`) and in the checked-in
  `dnd_journal.sql`; verified via direct REST calls. See `DECISIONS.md`.
- **Versioned rule delivery (2026-07-30)** — production VTM and Pathfinder
  browser consumers load separate, SHA-256-verified Supabase Storage releases
  with generated local fallbacks. Pathfinder additionally pins the remote
  manifest to the build's generated release, so a stale Supabase manifest
  cannot override newer checked-in rules. Pathfinder rules no longer enter the
  RSC payload; character/campaign tables and both character persistence formats
  are unchanged.
- **Pathfinder 2 full builder, staged work (2026-07-29)** — schema v4 is
  canonical and the route now uses an eleven-step builder plus unified v4
  character state. Pure engines cover attributes, skills, proficiencies,
  currency/Bulk, typed combat, spellcasting, details and sequential level-up.
  Canonical schema-v1 catalogs now drive ancestry feats (702), class feats
  (1309), 21 class progressions plus the global schedule, equipment (1823),
  weapons (400), armor (123), shields (92), deities (361), languages (23) and
  traits (212); `spells.json` supplies 1167 spells/cantrips/focus spells.
  Feat slots, progression grants, the shop, inventory/Bulk, attacks/AC,
  languages and deity validation are connected to schema v4. The class catalog
  exposes only the 21 classes that have complete progression data and local
  artwork. Normalized
  weapon/armor/shield values are consumed as provided, but entries marked by
  the source normalizer as needing owner mechanics still require data-quality
  review before rules-accurate production use. Normalizer script at
  `src/games/pathfinder2/scripts/normalize-rules.ts` is deterministic and
  idempotent. Ancestry, background and class galleries support characteristic
  filtering from pinned pf2r/PF2e dependency data.
- **TableTopGames portal and shared account (2026-07-29)** — `/` is the game selector, VTM lives under `/vampires/*`, and Pathfinder remains at `/pathfinder2/sheet`. The root `AccountProvider` uses the existing Vampire Supabase account, persists its session, and mirrors the profile into the legacy VTM storage keys used by the sheet, table and journal. Old root VTM URLs are compatibility redirects.
- **Game table master workspace (2026-08-01)** — scene folders are session
  groupings (`table_scene_folders` + `table_scenes.folder_id`), scene copies
  include layers/tokens/music, and per-scene `view_mode` switches players
  between stage-clamped Table and unrestricted Free. Layers now expose reusable
  background candidates (`table_images.is_background`), images/folders,
  text/documents and tokens; Media has unified file/folder/background upload and
  multi-select. The master character roster bulk-adds from her full gallery and
  the duplicate right-side Characters tab/password prompt are gone from the table.
  Needs live-room testing with a
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
- Hub + Modules architecture is **mostly complete** (`GameTable.tsx` ~2.4k lines —
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
- D&D journal: have the owner log in herself once to confirm the real edit
  experience plus folder create/rename/delete and an app↔site folder
  round-trip with production data (agents can't — no owner credentials).

## Do not touch casually
- `public/vampires/main.js`, `public/vampires/old-sheet.html` — read `workflows/legacy-edit-protocol.md`.
- `src/games/vampires/modules/table/GameTable.tsx` — read `workflows/react-table-edit-protocol.md`.
- Supabase table/bucket names & saved-data shape — read `workflows/supabase-edit-protocol.md`.
- `public/vampires/rules.json` / `rules_eng.json` — data layer, mind RU/EN drift.
- `src/games/dnd/journal/supabase/dnd_journal.sql`, `DND_JOURNAL_OWNER_AUTH_USER_ID` —
  the hardcoded owner Auth user id must match on both the SQL RLS and the TS
  constant, or the edit UI and the actual write permission disagree.

## Last updated
2026-07-31 — Fixed a live RLS bug: pages'/images' soft-delete and image
uploads were unconditionally failing since these tables were created
(Postgres requires the post-write row to also satisfy a SELECT policy).
See `DECISIONS.md`.
  Earlier same day: Fixed two D&D journal sync bugs on the iPad app side
(device-scoped `user_id` filter hid site-created content; merge ran without
a real conflict, resurrecting deleted text). See `DECISIONS.md`.
  Earlier: Added `/dnd/journal`: new `src/games/dnd/` domain, Supabase
schema applied live (`dnd_journal_pages`, `dnd_journal_images`, public
`dnd-journal-images` bucket), single hardcoded-owner-write + fully-public-read
RLS (no login needed to view). See `DECISIONS.md`.
  Earlier: Limited the Pathfinder class catalog to the 21 entries with
connected progression data and local artwork; removed six invalid unsupported
class entries. Earlier: Split VTM/Pathfinder rule delivery into separate read-only
Supabase buckets with immutable chunks, verified manifests and local fallbacks;
removed the oversized Pathfinder catalog from the server-component response.
  Earlier: Connected the normalized Pathfinder catalogs to feat slots,
class progression, proficiencies, shop/inventory/combat, languages, deity
validation and the catalog-readiness UI.
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
