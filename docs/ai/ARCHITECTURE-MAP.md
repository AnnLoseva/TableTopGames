# Architecture Map

How the app fits together at runtime. For per-file risk/protocol see `FILE-MAP.md`.
For a prose RU overview see `../architecture.md`.

## Runtime overview
Next.js App Router serves React routes under the TableTopGames product shell.
The `src/games/vampires/`, `src/games/pathfinder2/` and `src/games/dnd/` directories define game
ownership at the route boundary. The **VTM home screen, game table, journal, reference and private chronicle reader**
are modern React/TypeScript. The **full character sheet** is a legacy vanilla
HTML/JS app served from `public/vampires/` and embedded via an `<iframe>`. Both layers
persist to the same Supabase project. Pathfinder 2 keeps an isolated
React/localStorage character domain and does not access VTM tables or iframe
contracts; it uses its own read-only Storage bucket for rule delivery. D&D
(`src/games/dnd/`) is a third isolated domain: its journal (`/dnd/journal`) is
**public to read, no login required** — it only uses the site's account/Auth
(same Supabase project) to identify the one account allowed to edit. It owns
separate `dnd_journal_*` tables and a public storage bucket, and is the
**same journal data** the RenaCompanion iPad app (separate repo)
reads/writes — see "Flow: D&D journal" below.

## Routes
| Route | Component | Layer |
|---|---|---|
| `/` | `src/games/vampires/modules/home/HomeRoute` → `MainScreen.tsx` | React |
| `/vampires/character-sheet` | `src/games/vampires/modules/character-sheet/*` | React shell → legacy iframe |
| `/vampires/table` | `src/games/vampires/modules/table/TableRoute` → `GameTable.tsx` | React |
| `/vampires/journal` | `src/games/vampires/modules/journal/JournalRoute` | React |
| `/vampires/reference` | `src/games/vampires/modules/reference/ReferenceRoute` | React |
| `/vampires/library/chronicles` | `src/games/vampires/modules/chronicle-library/ChronicleLibraryRoute` | React + Supabase Auth/RLS |
| `/vampires/master` | `src/games/vampires/modules/master-console/MasterConsoleRoute` → `MasterConsoleShell` | React master console (6 modules, search, detached windows) |
| `/pathfinder2/sheet` | `src/games/pathfinder2/sheet/Pathfinder2SheetRoute` | React local character-creation draft |
| `/vampires/old` | `src/app/(vampires)/vampires/old/page.tsx` | redirect → `/vampires/character-sheet` |
| `/dnd/journal` | `src/games/dnd/journal/DndJournalRoute` | React + Supabase, shared with the RenaCompanion iPad app |

VTM route files live in `src/app/(vampires)/vampires/` and import their entries directly from
`src/games/vampires/modules/*`. Parentheses create an App Router route group, so the
physical boundary does not add a URL segment.

## Flow: master console
```text
/vampires/master?room=
 → MasterConsoleRoute (room validate + master password gate — not security)
 → MasterConsoleShell (topbar, sidebar|detached, host, right rail roller)
 → contributions.ts allow-list → lazy module loaders
 → src/games/vampires/modules/{overview,actors,scenes,lore,blood-bonds,session-log}
 → search providers + multi-window bus + master_layouts
 → Supabase master tables (RLS) + shared table APIs (scenes/rolls) where reused
```

## Flow: character sheet
```text
/vampires/character-sheet
 → CharacterSheetRoute → CharacterSheetScreen   (React shell + legacy/bridge.ts)
 → <iframe src="/vampires/old-sheet.html?room=&role=&characterId=&new=">
 → public/vampires/rules-catalog-loader.js
 → Supabase Storage `rules-vampires` or generated local fallback
 → public/vampires/main.js                    (legacy sheet logic)
 → public/vampires/supabase.js                (legacy Supabase client + character CRUD)
 → public/vampires/rules.json / rules_eng.json (source + direct fallback)
 → public/vampires/vtm-health.js, vtm-humanity.js, creation-wizard.js, i18n-*.js
 ← postMessage { type: 'vtm-character-saved', characterId }  (iframe → shell)
```

## Flow: game table
```text
/vampires/table
 → GameTable                         (orchestrator: room state + Supabase I/O)
 → src/games/vampires/modules/table/components/*        (Canvas, panels, dice, scenes, media, journal)
 → src/games/vampires/modules/chat/*                    (chat UI, auth, history, realtime)
 → src/games/vampires/modules/music/*                   (music UI, playback adapters, global engine)
 → src/games/vampires/modules/table/*                   (types, constants, mappers, api, hooks, utils)
 → src/games/vampires/core/vtm5/rules/*        (pure rules: health, humanity, damage, disciplines)
 → Supabase tables + storage buckets (realtime room sync)
```

## Flow: home
```text
/
 → HomeRoute
 → src/games/vampires/modules/home/components/MainScreen.tsx
 → Supabase `users` + light `characters` list
 → links to /vampires/character-sheet, /vampires/table, /vampires/journal, /vampires/reference, /vampires/library/chronicles
```

## Flow: Pathfinder 2 character creator

```text
/pathfinder2/sheet
 → src/games/pathfinder2/sheet/Pathfinder2SheetRoute
 → Pathfinder2SheetPage
 → build-pinned verified manifest + immutable chunks from `rules-pathfinder2`
 → generated local `/rules/pathfinder2/*` fallback when remote is stale/unavailable
 → sheet + eleven-step client creator + level-up flow
 → pure attribute/skill/creation/progression rules
 → schema-v3 runtime adapter
 → localStorage `pathfinder2-character-draft-v4`
 → read-only migration from v3/v1 keys
 → owner-selected `gnuraco/pf2r` catalogs (checked-in source of truth)
```

## Flow: D&D journal

```text
/dnd/journal  (public — no login required to view)
 → DndJournalRoute (@/platform/account session optional; used only to check editor identity)
 → isEditor = auth.uid() === DND_JOURNAL_OWNER_AUTH_USER_ID  (one fixed account; false for guests)
 → src/games/dnd/journal/api/{journal-api,folders-api,images-api}.ts
 → updateJournalPage: bodyMarkdown reconciles against the current row via
    src/games/dnd/journal/merge.ts when it changed since this edit's baseline
    (paragraph-level merge, not last-write-wins — see DECISIONS)
 → dnd_journal_pages, dnd_journal_folders, dnd_journal_images
    — pages point to nested folders with folder_id; both support manual sort_order
    — SELECT is `to public`; only owner/device identities can INSERT/UPDATE
 → dnd-journal-images storage bucket (public bucket, getPublicUrl; same owner-write rule)
 → realtime postgres_changes on pages + folders from either allowed writer
```

Read is fully public (no account, no login — anyone with the link); write is
single-editor on the site, enforced by RLS against the owner plus the dedicated
RenaCompanion device identity (not by row ownership). The iPad app actively
pushes/pulls the same pages, images and three-level folder tree; folder deletes
use tombstones so an offline device cannot resurrect them. Structured entry
fields remain app-local. Row ids are client-generated UUIDs so either side can
write the same page/folder/image without a round trip. Schema is
**applied** to the live project — see
`src/games/dnd/journal/supabase/dnd_journal.sql` and `DECISIONS.md`
(2026-07-31).

## Flow: private chronicle library

```text
/vampires/library/chronicles
 → ChronicleLibraryRoute → ChronicleLibraryPage
 → list/open authorized library chronicle memberships
 → RLS-scoped `library_chronicle_chunks` reader + client-side document search
 → Storyteller-only Markdown/TXT parser
 → `replace_library_chronicle_document(...)` (RLS + membership-gated atomic replace)
 → player TXT/Markdown/SRT/VTT → persisted raw chunks → authenticated
   `personal-chronicle-processor` calls → full clean transcript + short personal chronicle
 → owner-only personal document reader/search + downloadable Markdown
```

## Flow: master console

```text
/vampires/master?room=<room-id>
 → MasterConsoleRoute (requires explicit valid room + compatibility master gate)
 → bootstrapMasterConsoleForRoom
 → createVtm5ChronicleHub / bootstrapChronicleRuntime
 → MasterConsoleShell (topbar + sidebar + empty module host + right rail)
```

The shell reuses the canonical table room resolver and master-password storage
contract, but does not import or render `GameTable`. It has no Supabase tables or
business-module runtime yet. The client password prevents URL-only role bypass;
it is not a substitute for the Auth/RLS security model.

## Legacy layer (`public/vampires/`)
Vanilla, no build step. `old-sheet.html` (markup/styles) + `main.js` (logic) +
`supabase.js` (data) + `creation-wizard.js` (creation) + `vtm-health.js` /
`vtm-humanity.js` (mechanics duplicates) + `i18n-runtime.js` / `i18n-dictionary.js`
(translation). Reads a verified versioned rules release with checked-in
`rules.json` / `rules_eng.json` as fallback. Communicates with the React
shell only through URL params, localStorage, and `postMessage`.

## React / Next layer (`src/app/`, `src/games/`, `components/`)
App Router route files are thin wrappers over `src/games/vampires/modules/*Route` entries.
VTM wrappers live under `src/app/(vampires)/vampires/`; Pathfinder 2 is implemented directly
under `src/app/pathfinder2/` and `src/games/pathfinder2/`.
`src/games/vampires/modules/home/*` owns the entry screen. Canonical table/chat/music/journal/reference/chronicle-library
code lives in `src/games/vampires/modules/*`; deprecated component and `lib/table/*` re-export shims
have been removed. Shared state and Supabase I/O for the table currently
concentrate in `GameTable.tsx`.

## VTM mechanics layer (`src/games/vampires/core/vtm5/rules/*`)
Pure, framework-independent rules: `health/index.ts`, `humanity/index.ts`,
`damage/index.ts`, `derived-stats/index.ts`, and `disciplines/*` (engine, costs,
durations, effects, schema, rules-loader, character-disciplines, active-effects,
legacy-cost-parser).
This is the runtime home for TypeScript rules that may still have legacy JS
duplicates.

## Data / rules layer
`public/vampires/rules.json` (RU, ~34k lines) and
`public/vampires/rules_eng.json` (EN) define
clans, skills, disciplines, merits, flaws, predator types. Consumed by both the
legacy sheet and build-time rule loaders. Runtime browser delivery uses
content-addressed Supabase/local manifests. `src/games/vampires/lib/i18n/ruleNames.ts`
maps display names ↔ stable identifiers.

## Supabase layer
- Client: `src/games/vampires/lib/supabase.ts` (React), `public/vampires/supabase.js` (legacy).
- Tables: `characters`, `users`, `table_rolls`, `table_chat_messages`,
  `table_images`, `table_scenes`, `table_scene_music`, `table_music`,
  `table_music_library`, `media_studio_layers`, `book_pages`; master foundation:
  `chronicles`, `chronicle_members`, `chronicle_sessions`, `master_layouts`,
  `master_macros`, `chronicle_entity_links`, `master_action_log`; actor domain:
  `chronicle_actors`, `chronicle_actor_private`; private Library game history:
  `library_chronicles`, `library_chronicle_members`,
  `library_chronicle_chunks`; owner-only player history:
  `personal_chronicle_jobs`, `personal_chronicle_job_chunks`,
  `personal_chronicle_documents`, `personal_chronicle_document_chunks`.
- Buckets: `table-images`, a music bucket, `character-portraits`,
  `rules-vampires` and `rules-pathfinder2`.
- Table names centralized in `src/games/vampires/modules/table/constants.ts`.
- Schema/policies live in `src/games/vampires/supabase/*.sql`.
- Separate, unrelated to the above: the D&D journal domain owns
  `dnd_journal_pages`, `dnd_journal_folders`, `dnd_journal_images` and the public
  `dnd-journal-images` bucket, defined in
  `src/games/dnd/journal/supabase/dnd_journal.sql` (applied). It reuses the
  same Supabase project/Auth but not any VTM table, and unlike every VTM
  table its RLS is not row-ownership-based — read is open to `public` (no
  login), write is restricted to the hardcoded owner and device Auth ids.
- Library game history is selected by exact title once, then restored from the
  caller's last-opened membership. DeepSeek searches it only through the
  membership-scoped RPC using the caller's JWT; this membership never grants a
  master-console or room role. `/vampires/library/chronicles` renders the same private
  chunks as readable Markdown. Uploads replace one named document atomically
  and require both an authoritative Storyteller role and an existing library
  membership for the target chronicle.
- Player transcripts are chunked and persisted before bounded AI calls. Their
  raw parts and two final documents remain owner-only; the Librarian combines
  official and personal search RPCs using the caller's Auth JWT.

## Media / table layer
Images, video, files and layers on the table canvas (tldraw). Utilities in
`src/games/vampires/modules/table/utils/*`; UI in `src/games/vampires/modules/table/components/*`.
Music lives in `src/games/vampires/modules/music/*` with local-audio and YouTube
adapters. `src/app/(vampires)/vampires/layout.tsx` mounts `GlobalMusicEngineMount` so playback
survives VTM route navigation without leaking into Pathfinder.

## Actor domain

`src/games/vampires/modules/actors/*` is the UI-independent abstraction for PC, full NPC and
compact SPC records. Linked actors hydrate the canonical `characters` row via
the table character API; compact actors use their own small stat block. VTM
vitals and roll pools are calculated by
`src/games/vampires/core/vtm5/adapters/actors.ts`. Realtime actor/private subscriptions are
filtered by room; linked character subscriptions are filtered by their IDs.

## Known duplication
- Health logic: `src/games/vampires/core/vtm5/rules/health/index.ts` ↔ `public/vampires/vtm-health.js`.
- Humanity logic: `src/games/vampires/core/vtm5/rules/humanity/index.ts` ↔ `public/vampires/vtm-humanity.js`.
- Discipline/cost parsing: `src/games/vampires/core/vtm5/rules/disciplines/*` ↔ legacy parsing in `main.js`.
- Supabase access exists in both `src/games/vampires/lib/supabase.ts` and `public/vampires/supabase.js`.
- Rules names duplicated RU/EN across the two rules JSON files.

## Direction of future refactor
Extract legacy logic into `src/games/vampires/core/vtm5/rules/*` and `src/games/vampires/modules/table/*` in small, verified steps;
keep the iframe until a dedicated migration task exists; never regress the UI or
change VTM rules content during a refactor. See `ROADMAP.md` and `DECISIONS.md`.
Keep shared Hub contracts game-neutral in `src/platform/hub/*`; VTM-specific additions
belong under `src/games/vampires/`, and Pathfinder must remain independent.
