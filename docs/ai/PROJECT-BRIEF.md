# Project Brief

## One-line description
TableTopGames is a multi-game tabletop RPG workspace: a production Vampire:
The Masquerade V5 character sheet and campaign room plus an isolated Pathfinder
2 character-creation route.

## Product goal
Let a VTM V5 group run a chronicle online: each player keeps a full character
sheet, and everyone shares a real-time game table with scenes, media, dice rolls,
chat, journal, music, and a rules reference — persisted so a room can be left and
resumed. Let Pathfinder 2 players build a local character draft without coupling
that new game to the VTM persistence contracts.

## Target user
- **Players** — fill in and maintain their vampire character sheet, roll dice,
  take damage, track hunger/willpower/humanity.
- **Master (Storyteller)** — runs the room: scenes, media layers, music, NPCs,
  and adjudicates rolls.
- **Pathfinder 2 players** — build a six-step local character draft and consult
  contextual Russian rules links.

Single app, two roles, driven by a `role` (`master` | `player`) parameter.

## Main modes
1. **Character sheet** — the full V5 sheet (currently the legacy sheet in an
   iframe) with creation, saving, health/humanity, disciplines.
2. **Game table** — the shared campaign room (`GameTable`): scenes, media,
   layers, dice, chat, journal, music.
3. **Journal** — `/vampires/journal`, a TipTap-based rich journal.
4. **Reference** — `/vampires/reference`, a markdown rules reference.
5. **Chronicle library** — `/vampires/library/chronicles`, a private Markdown archive
   with membership-scoped official history and owner-only processed player
   transcripts/personal recaps.
6. **Master console** — `/vampires/master?room=...`, a desktop shell for future
   Storyteller modules; currently protected by the compatibility master-password gate.
7. **Pathfinder 2 character creator** — `/pathfinder2/sheet`, an unlisted,
   browser-local creation draft.

Typical flow: **main screen → pick/create character → open room → jump between
sheet and table**, carrying `room`, `role`, `characterId`.

## Current tech stack
- **Next.js 16 (App Router)**, **React 19**, **TypeScript**
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) for DB + storage
- **tldraw** (table canvas), **three** (3D), **framer-motion** (animation)
- **TipTap** (journal editor), **react-markdown / remark-gfm** (reference)
- Legacy character sheet: **vanilla HTML/CSS/JS** in `public/vampires/` (no build step)

## Core routes
| Route | Renders | Notes |
|---|---|---|
| `/` | `HomeRoute` → `MainScreen` | Landing / entry (character & room selection) |
| `/vampires/character-sheet` | `CharacterSheetScreen` → iframe `/vampires/old-sheet.html` | The full legacy sheet |
| `/vampires/table` | `GameTable` | The shared campaign room |
| `/vampires/journal` | Journal editor | Rich-text journal |
| `/vampires/reference` | Reference pages | Markdown rules reference |
| `/vampires/library/chronicles` | `ChronicleLibraryRoute` | Official Chronicle reader, Storyteller upload and owner-only player transcript processing |
| `/vampires/master?room=<room-id>` | `MasterConsoleRoute` → `MasterConsoleShell` | Desktop Storyteller workspace shell; room is required |
| `/pathfinder2/sheet` | `src/games/pathfinder2/sheet/Pathfinder2SheetRoute` | Unlisted local Pathfinder 2 character creator |
| `/vampires/old` | redirect | Legacy redirect → `/vampires/character-sheet` |

## Main data sources
- **`public/vampires/rules.json` / `public/vampires/rules_eng.json`** — clans, skills, disciplines,
  merits, flaws, predator types (RU + EN). The rules data layer.
- **Supabase tables** — `characters`, `users`, `table_rolls`,
  `table_chat_messages`, `table_images`, `table_scenes`, `table_scene_music`,
  `table_music`, `table_music_library`, `media_studio_layers`, plus private
  `library_chronicles`, `library_chronicle_members` and
  `library_chronicle_chunks`, plus owner-only personal Chronicle jobs,
  source chunks and final documents.
- **Supabase storage buckets** — `table-images` and a music bucket for uploaded
  table/media assets.
- **localStorage** — room/role and character-creation drafts (bridge state).
- **Pathfinder 2 local data** — starter creation options and short original
  rules notes in `src/games/pathfinder2/sheet/*`; the draft uses its own localStorage
  key and links to `pf2.ru` for complete source text.

## Non-goals
- Not rebuilding the app from scratch or imposing a "perfect" architecture.
- Not migrating the legacy sheet out of the iframe (no task for it yet).
- Not refactoring `GameTable.tsx` wholesale.
- Not changing VTM rules content as a side effect of other work.
- Not a generic AI-memory system — this context is specific to this site.

## Design direction
Each game owns its visual language: dark blood-red VTM and parchment/forest
Pathfinder 2. Keep the current VTM UI stable. Evolve gradually from the legacy
monolith toward modular React + `src/games/vampires/core/vtm5/rules/*` rules, in small safe
steps — without abrupt rewrites or UI regressions.
