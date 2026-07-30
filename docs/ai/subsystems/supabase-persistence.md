# Supabase Persistence

## Purpose
Supabase is the shared backend for both VTM layers: it stores characters and
game-table state (rolls, chat, scenes, media, layers, music), provides realtime
room sync, and delivers public versioned rule catalogs for VTM and Pathfinder.
Pathfinder character data remains browser-local. The schema is a **contract**
shared by the React table and the legacy sheet — undocumented drift breaks
save/load and sync everywhere.

## Main files
- `src/games/vampires/lib/supabase.ts` — the React/Next Supabase client.
- `public/vampires/supabase.js` — the legacy client + `characters` CRUD (create/update/
  load/list, with `charactersListCache`).
- `src/games/vampires/modules/table/constants.ts` — centralizes table + bucket names + keys.
- `src/games/vampires/modules/table/mappers.ts` — maps Supabase rows ↔ app objects.
- `src/games/vampires/supabase/*.sql` — table definitions, RLS policies, and storage bucket setup.
  `src/games/vampires/supabase/patch_character_data.sql` defines the character autosave patch RPC.

## Tables and buckets
Tables (from `src/games/vampires/modules/table/constants.ts` and `src/games/vampires/supabase/*.sql`):

| Table | Used by | Purpose |
|---|---|---|
| `characters` | legacy sheet + table | Character records (save/load) |
| `users` | app | User records |
| `book_pages` | rules chat | Authenticated, page-addressed rulebook text + FTS |
| `library_chronicles` | rules chat | Private library chronicle titles/availability |
| `library_chronicle_members` | rules chat | Owner-scoped subscriptions and last-opened order |
| `library_chronicle_chunks` | rules chat | Section-addressed private game text + Russian FTS |
| `personal_chronicle_jobs` | chronicle library | Owner-only resumable transcript processing state |
| `personal_chronicle_job_chunks` | chronicle library | Owner-only raw, cleaned and summary parts |
| `personal_chronicle_documents` | chronicle library + rules chat | Owner-only full/short final document metadata |
| `personal_chronicle_document_chunks` | chronicle library + rules chat | Owner-only final Markdown chunks + Russian FTS |
| `table_rolls` | table + master public rolls | Dice rolls per room (player-visible) |
| `master_hidden_rolls` | master-rolls | Master-only hidden rolls until reveal |
| `master_session_notes` | master-overview | Private session notes (autosave) |
| `master_plot_hooks` | master-overview | Active plot hooks and heat status |
| `master_scene_meta` | master-scenes | Draft light preset, encounter marker, archive order |
| `master_scene_objects` | master-scenes | Master interactives (private config) |
| `master_scene_objects_public` | master-scenes | Revealed interactives without secrets |
| `chronicle_lore_categories` | lore | Custom + chronicle category rows |
| `chronicle_lore_entries` | lore | Chronicle lore entries (no system rules) |
| `chronicle_lore_entry_private` | lore | GM-only private notes |
| `chronicle_random_tables` | lore | Weighted random tables |
| `blood_bonds` | blood-bonds | Active thrall→regnant bonds (master) |
| `blood_bond_events` | blood-bonds | Append-only bond history |
| `table_chat_messages` | table | Room chat |
| `table_images` | table | Images/media placed on the table |
| `table_scenes` | table | Scenes (incl. `background_url`, `width`, `height` — the stage) |
| `table_tokens` | table | Character tokens above the media layer |
| `table_character_controllers` | table | Which room users control which characters |
| `table_scene_music` | table | Music attached to scenes |
| `table_music` | table | Music state/playback |
| `table_music_library` | table | Saved music library entries |
| `media_studio_layers` | table | Layer definitions for media |
| `chronicles` | master console security | Authoritative room/chronicle identity |
| `chronicle_members` | master console security | Supabase Auth membership and role |
| `chronicle_sessions` | master console | Session/night metadata and master summaries |
| `master_layouts` | master console | Per-owner versioned desktop layouts |
| `master_macros` | master console | Shared or owner-scoped macro definitions |
| `chronicle_entity_links` | master console | Validated generic entity relations |
| `master_action_log` | master console | Append-only master action history |
| `chronicle_actors` | actors | Chronicle actor metadata, compact stat blocks and character links |
| `chronicle_actor_private` | actors | Physically separate GM-only actor fields |

Storage buckets: `table-images` (constant `TABLE_IMAGE_BUCKET`), a music bucket,
and `character-portraits` (portraits + touchstone images; see
`src/games/vampires/supabase/character_portraits_storage.sql`). Public-read,
browser-read-only rule delivery uses separate `rules-vampires` and
`rules-pathfinder2` buckets; see
`src/games/vampires/supabase/rules_catalog_storage.sql`. Rules are generated
from Git-tracked sources, published under immutable content-addressed paths and
referenced by a short-lived manifest. RLS/permissions live in the relevant
`src/games/vampires/supabase/*.sql` files. Pathfinder accepts a remote manifest
only when its release matches the generated manifest shipped with the current
build; otherwise it loads that build's verified local chunks.

**Images are never embedded as base64 in rows.** Portraits/touchstone images go
through `uploadPortraitDataUrl` (`public/vampires/supabase.js`) into `character-portraits`;
`characters.data` and `table_chat_messages.character_image` hold public URLs
(base64 only as upload-failure fallback). See the 2026-07-07 DECISIONS entry.

## Character persistence
Handled by the **legacy** `public/vampires/supabase.js` against the `characters` table
(the React table also reads `characters` to load player sheets). Saving emits the
`vtm-character-saved` postMessage back to the bridge (see
`character-sheet-bridge.md`). Changing the character row shape affects both
layers.

Legacy autosave patching uses the `vtm_patch_character_data(p_id, p_user_id,
p_patch)` RPC when deployed. The RPC deep-merges object keys atomically in
Postgres and replaces arrays/scalars/nulls whole, matching `mergeCharacterPatch`
in `public/vampires/supabase.js`; the browser keeps a select+merge+update fallback while
the SQL is not deployed.

## Table persistence
`GameTable.tsx` reads/writes most `table_*` tables and subscribes to a per-room
realtime channel (`table-room:{room}`). Chat is handled by `src/games/vampires/modules/chat/*`
against `table_chat_messages`. Names must come from `src/games/vampires/modules/table/constants.ts`;
row mapping belongs in the relevant module/API.

## Master console persistence

`src/games/vampires/supabase/master_console_persistence.sql` is the schema/RLS contract;
`src/games/vampires/modules/master-console/persistence/*` owns constants, types, validation and
mappers. APIs and Realtime hooks are in the adjacent `api/` and `hooks/`
directories. Every subscription is filtered by `room` and cleaned up on effect
teardown. These tables revoke anon access and require Supabase Auth plus a
`chronicle_members` master role. They are deliberately not connected to the
legacy localStorage password gate. Initial chronicle/master provisioning is an
administrator/service-role operation.

Actor persistence is defined separately in `src/games/vampires/supabase/chronicle_actors.sql` and
depends on the master foundation. A partial unique index prevents linking the
same `characters.id` twice within one chronicle. Linked character data is loaded
from `characters` on hydration and is never copied wholesale into the actor row.
GM-only fields use `chronicle_actor_private`; both actor tables require master
membership. Bulk actor changes use one whitelisted, room-scoped RPC.

Rules chat book search uses `book_pages` and the authenticated-only
`search_book_pages(query, source, limit)` RPC. The authenticated
`librarian-chat` Edge Function gives DeepSeek three controlled read-only tools:
book search through that RPC, owner-only character lookup through
`get_my_characters()`, and active-game search through
`search_library_chronicle(...)`. Every tool call is validated and executed with
the caller's Auth JWT; the model never gets SQL or database credentials. It can
refine short rule-language queries and request several partially named
characters, while the browser keeps device-local journal access. Text is
normalized during ingest; keep PDF page numbers stable so book citations remain
verifiable. Every browser request also carries an allow-listed
`preferredEdition` (`V5`, `V20` or `general`); an explicit edition in the
question overrides that default, and `general` leaves book search unrestricted.
A successful fallback to the other edition is tracked for the request, and the
Edge Function prefixes a clear edition warning if the model omitted one.

Library game history is deliberately separate from master-console membership.
`open_library_chronicle(title)` subscribes the current Auth user only when the
normalized title matches an active library chronicle; it cannot grant a room
role. `list_my_library_chronicles()` drives last-opened preselection, and both
the chunk RLS policy and search RPC require the caller's own
`library_chronicle_members` row. Chronicle source text is private data: ingest
it directly into Supabase, never into the repository.

`/vampires/library/chronicles` reads those same chunks directly under RLS and groups them
back into Markdown documents. An authenticated user with an authoritative
`chronicle_members.role = 'master'` may upload Markdown/TXT only into a library
chronicle they have already joined. `replace_library_chronicle_document(...)`
is `SECURITY INVOKER`: its delete/insert stays under dedicated chunk write
policies, validates the JSON/size limits, and atomically replaces rows with the
same `source_name`. This makes the new text immediately available to every
member and to the existing DeepSeek chronicle-search tool without giving the
model or browser any general database capability.

Player uploads use the separate `src/games/vampires/supabase/personal_chronicles.sql` contract.
The browser stores the entire normalized source as ordered raw chunks before AI
work starts. `personal-chronicle-processor` performs one authenticated DeepSeek
operation per request, writes each cleaned chunk immediately, then creates a
full speaker-labelled transcript plus a shorter player-perspective chronicle
through `complete_personal_chronicle_job(...)`. Interrupted jobs are resumable.
All four personal tables enforce `user_id = auth.uid()`; Chronicle membership
only validates the grouping target and never expands read access. The
Librarian's fixed Chronicle tool combines `search_library_chronicle(...)` with
`search_my_personal_chronicle(...)`, both under the caller's JWT.

## Music / media persistence
Images/media → `table_images` + `table-images` bucket; music → `table_music`,
`table_music_library`, `table_scene_music` + the music bucket; layers →
`media_studio_layers`. See `music-and-media.md`.

## Schema drift risks
- Renaming a table/bucket without updating `constants.ts` + `src/games/vampires/supabase/*.sql` +
  both clients breaks that feature.
- Changing a row's columns/shape without a migration note breaks save/load.
- Two clients (`src/games/vampires/lib/supabase.ts`, `public/vampires/supabase.js`) can diverge in config.
- RLS changes can silently block anon/authenticated access.

## Safe edit protocol
1. Read `../workflows/supabase-edit-protocol.md`.
2. Never rename tables/buckets casually. Change name in `constants.ts`, both
   clients, mappers, and `src/games/vampires/supabase/*.sql` together.
3. Never change saved-data shape without a migration note in `DECISIONS.md`.
4. Verify master and player room flow after any change.

## Related docs
`game-table.md`, `character-sheet-bridge.md`, `music-and-media.md`,
`../workflows/supabase-edit-protocol.md`.
