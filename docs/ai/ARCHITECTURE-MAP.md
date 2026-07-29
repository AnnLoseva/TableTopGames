# Architecture Map

How the app fits together at runtime. For per-file risk/protocol see `FILE-MAP.md`.
For a prose RU overview see `../architecture.md`.

## Runtime overview
Next.js App Router serves React routes under the TableTopGames product shell.
The `games/vampires/` and `games/pathfinder2/` directories define game ownership
at the route boundary. The **VTM home screen, game table, journal, reference and private chronicle reader**
are modern React/TypeScript. The **full character sheet** is a legacy vanilla
HTML/JS app served from `public/` and embedded via an `<iframe>`. Both layers
persist to the same Supabase project. Pathfinder 2 is an isolated React/localStorage
domain and does not access the VTM Supabase or iframe contracts.

## Routes
| Route | Component | Layer |
|---|---|---|
| `/` | `modules/home/HomeRoute` → `MainScreen.tsx` | React |
| `/character-sheet` | `modules/character-sheet/*` | React shell → legacy iframe |
| `/table` | `modules/table/TableRoute` → `GameTable.tsx` | React |
| `/journal` | `modules/journal/JournalRoute` | React |
| `/reference` | `modules/reference/ReferenceRoute` | React |
| `/library/chronicles` | `modules/chronicle-library/ChronicleLibraryRoute` | React + Supabase Auth/RLS |
| `/master` | `modules/master-console/MasterConsoleRoute` → `MasterConsoleShell` | React master console (6 modules, search, detached windows) |
| `/pathfinder2/sheet` | `games/pathfinder2/sheet/Pathfinder2SheetRoute` | React local character-creation draft |
| `/old` | `app/old/page.tsx` | redirect → `/character-sheet` |

The VTM route files import small facades from `games/vampires/routes/*`. Those
facades keep the existing load-bearing implementation in `modules/`,
`core/systems/vtm5/` and `public/` while making game ownership explicit.

## Flow: master console
```text
/master?room=
 → MasterConsoleRoute (room validate + master password gate — not security)
 → MasterConsoleShell (topbar, sidebar|detached, host, right rail roller)
 → contributions.ts allow-list → lazy module loaders
 → modules/{overview,actors,scenes,lore,blood-bonds,session-log}
 → search providers + multi-window bus + master_layouts
 → Supabase master tables (RLS) + shared table APIs (scenes/rolls) where reused
```

## Flow: character sheet
```text
/character-sheet
 → CharacterSheetRoute → CharacterSheetScreen   (React shell + legacy/bridge.ts)
 → <iframe src="/old-sheet.html?room=&role=&characterId=&new=">
 → public/main.js                    (legacy sheet logic)
 → public/supabase.js                (legacy Supabase client + character CRUD)
 → public/rules.json / rules_eng.json (rules data)
 → public/vtm-health.js, vtm-humanity.js, creation-wizard.js, i18n-*.js
 ← postMessage { type: 'vtm-character-saved', characterId }  (iframe → shell)
```

## Flow: game table
```text
/table
 → GameTable                         (orchestrator: room state + Supabase I/O)
 → modules/table/components/*        (Canvas, panels, dice, scenes, media, journal)
 → modules/chat/*                    (chat UI, auth, history, realtime)
 → modules/music/*                   (music UI, playback adapters, global engine)
 → modules/table/*                   (types, constants, mappers, api, hooks, utils)
 → core/systems/vtm5/rules/*        (pure rules: health, humanity, damage, disciplines)
 → Supabase tables + storage buckets (realtime room sync)
```

## Flow: home
```text
/
 → HomeRoute
 → modules/home/components/MainScreen.tsx
 → Supabase `users` + light `characters` list
 → links to /character-sheet, /table, /journal, /reference, /library/chronicles
```

## Flow: Pathfinder 2 character creator

```text
/pathfinder2/sheet
 → games/pathfinder2/sheet/Pathfinder2SheetRoute
 → Pathfinder2SheetPage (six-step client creator)
 → starter options + original short rules guides
 → localStorage `pathfinder2-character-draft-v1`
 → contextual external searches on pf2.ru (full source text stays there)
```

## Flow: private chronicle library

```text
/library/chronicles
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
/master?room=<room-id>
 → MasterConsoleRoute (requires explicit valid room + compatibility master gate)
 → bootstrapMasterConsoleForRoom
 → createVtm5ChronicleHub / bootstrapChronicleRuntime
 → MasterConsoleShell (topbar + sidebar + empty module host + right rail)
```

The shell reuses the canonical table room resolver and master-password storage
contract, but does not import or render `GameTable`. It has no Supabase tables or
business-module runtime yet. The client password prevents URL-only role bypass;
it is not a substitute for the Auth/RLS security model.

## Legacy layer (`public/`)
Vanilla, no build step. `old-sheet.html` (markup/styles) + `main.js` (logic) +
`supabase.js` (data) + `creation-wizard.js` (creation) + `vtm-health.js` /
`vtm-humanity.js` (mechanics duplicates) + `i18n-runtime.js` / `i18n-dictionary.js`
(translation). Reads `rules.json` / `rules_eng.json`. Communicates with the React
shell only through URL params, localStorage, and `postMessage`.

## React / Next layer (`app/`, `games/`, `components/`)
App Router route files are thin wrappers over `modules/*Route` entries.
VTM wrappers pass through `games/vampires/routes/*`; Pathfinder 2 is implemented
directly under `games/pathfinder2/`.
`modules/home/*` owns the entry screen. Canonical table/chat/music/journal/reference/chronicle-library
code lives in `modules/*`; deprecated component and `lib/table/*` re-export shims
have been removed. Shared state and Supabase I/O for the table currently
concentrate in `GameTable.tsx`.

## VTM mechanics layer (`core/systems/vtm5/rules/*`)
Pure, framework-independent rules: `health/index.ts`, `humanity/index.ts`,
`damage/index.ts`, `derived-stats/index.ts`, and `disciplines/*` (engine, costs,
durations, effects, schema, rules-loader, character-disciplines, active-effects,
legacy-cost-parser).
This is the runtime home for TypeScript rules that may still have legacy JS
duplicates.

## Data / rules layer
`public/rules.json` (RU, ~34k lines) and `public/rules_eng.json` (EN) define
clans, skills, disciplines, merits, flaws, predator types. Consumed by both the
legacy sheet and `core/systems/vtm5/rules/disciplines/rules-loader/index.ts`. `lib/i18n/ruleNames.ts`
maps display names ↔ stable identifiers.

## Supabase layer
- Client: `lib/supabase.ts` (React), `public/supabase.js` (legacy).
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
- Buckets: `table-images` and a music bucket.
- Table names centralized in `modules/table/constants.ts`.
- Schema/policies live in `supabase/*.sql`.
- Library game history is selected by exact title once, then restored from the
  caller's last-opened membership. DeepSeek searches it only through the
  membership-scoped RPC using the caller's JWT; this membership never grants a
  master-console or room role. `/library/chronicles` renders the same private
  chunks as readable Markdown. Uploads replace one named document atomically
  and require both an authoritative Storyteller role and an existing library
  membership for the target chronicle.
- Player transcripts are chunked and persisted before bounded AI calls. Their
  raw parts and two final documents remain owner-only; the Librarian combines
  official and personal search RPCs using the caller's Auth JWT.

## Media / table layer
Images, video, files and layers on the table canvas (tldraw). Utilities in
`modules/table/utils/*`; UI in `modules/table/components/*`.
Music in `modules/music/*` with local-audio and YouTube adapters. The root
layout mounts `GlobalMusicEngineMount` so playback survives route navigation.

## Actor domain

`modules/actors/*` is the UI-independent abstraction for PC, full NPC and
compact SPC records. Linked actors hydrate the canonical `characters` row via
the table character API; compact actors use their own small stat block. VTM
vitals and roll pools are calculated by
`core/systems/vtm5/adapters/actors.ts`. Realtime actor/private subscriptions are
filtered by room; linked character subscriptions are filtered by their IDs.

## Known duplication
- Health logic: `core/systems/vtm5/rules/health/index.ts` ↔ `public/vtm-health.js`.
- Humanity logic: `core/systems/vtm5/rules/humanity/index.ts` ↔ `public/vtm-humanity.js`.
- Discipline/cost parsing: `core/systems/vtm5/rules/disciplines/*` ↔ legacy parsing in `main.js`.
- Supabase access exists in both `lib/supabase.ts` and `public/supabase.js`.
- Rules names duplicated RU/EN across the two rules JSON files.

## Direction of future refactor
Extract legacy logic into `core/systems/vtm5/rules/*` and `modules/table/*` in small, verified steps;
keep the iframe until a dedicated migration task exists; never regress the UI or
change VTM rules content during a refactor. See `ROADMAP.md` and `DECISIONS.md`.
Move VTM internals behind `games/vampires/` only subsystem-by-subsystem; do not
bulk-move `public/` or the shared module tree.
