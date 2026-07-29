# File Map

Practical map of the files an agent is most likely to touch. Read this **before
opening code**. Risk levels drive how careful you must be.

## Risk levels
- **critical** — do **not** edit without reading the matching workflow first; a
  mistake breaks core flows (sheet save/load, room sync, rules).
- **high** — check all cross-references/usages before editing.
- **medium** — local verification required (types, the affected route).
- **low** — safe to edit in a focused, local way.

## Routes & screens
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/app/(vampires)/vampires/page.tsx` | `/` route → `src/games/vampires/modules/home/HomeRoute` | low | before-any-change | Thin wrapper |
| `src/app/(vampires)/vampires/character-sheet/page.tsx` | `/vampires/character-sheet` route | low | before-any-change | Thin wrapper |
| `src/app/(vampires)/vampires/table/page.tsx` | `/vampires/table` route | low | before-any-change | Thin wrapper |
| `src/app/(vampires)/vampires/master/page.tsx` | `/vampires/master` route | low | before-any-change | Thin wrapper; explicit `room` required |
| `src/app/(vampires)/vampires/layout.tsx` | VTM-only providers, metadata, theme and persistent music mount | medium | before-any-change | Route group does not change URLs |
| `src/app/pathfinder2/sheet/page.tsx` | `/pathfinder2/sheet` route | low | before-any-change | Thin wrapper; intentionally unlinked from `/` |
| `src/app/(vampires)/vampires/old/page.tsx` | legacy redirect | low | before-any-change | Redirects to `/vampires/character-sheet` |

## Game domain boundaries (`src/games/*`)

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/core/*` | VTM Hub preset/runtime and V5 rules | high | vtm-mechanics-edit-protocol | Shared Hub types stay in `src/platform/hub/*` |
| `src/games/vampires/modules/*` | VTM feature domains and route entries | medium–critical | subsystem workflow | Do not place Pathfinder code here |
| `src/games/vampires/lib/*` | VTM i18n and Supabase client | high | subsystem workflow | VTM-only |
| `src/games/vampires/styles/*` | VTM global theme loaded by the VTM route group | medium | before-any-change | Keep Pathfinder styling isolated |
| `src/games/pathfinder2/sheet/Pathfinder2SheetRoute.tsx` | Pathfinder 2 route entry | low | before-any-change | Thin wrapper |
| `src/games/pathfinder2/sheet/components/*` | Two-mode Pathfinder 2 sheet, ten-step builder and reusable choice galleries | medium | before-any-change | Local-only, no Supabase |
| `src/games/pathfinder2/sheet/{data,types}.ts` | Character draft model, static UI steps and shared catalog types | medium | before-any-change | Independent from VTM rules data |
| `src/games/pathfinder2/sheet/{data,hooks,rules}/*` | Schema-v4 persistence/migration, catalog audit/contracts and pure attribute, skill, validation and progression engine | medium | before-any-change | v3 remains a transitional runtime adapter; keep localStorage/calculations framework-isolated, run `test:pathfinder2-builder` + `test:pathfinder2-data` |
| `src/games/pathfinder2/sheet/rules-data.ts` | Server-only adapter from raw Pathfinder JSON to the sheet catalog | medium | before-any-change | Keep raw JSON out of the client component |
| `src/games/pathfinder2/sheet/rules-source.ts` | Short rule guides + pf2.ru search links | medium | before-any-change | Do not scrape or vendor full site content |
| `src/games/pathfinder2/Rules/*.json` | Owner-provided Pathfinder ancestries, backgrounds, classes and feats | high | before-any-change | Preserve source/version/license metadata; keep schema changes behind `rules-data.ts` |

## Home module (`src/games/vampires/modules/home/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/home/HomeRoute.tsx` | `/` entry | low | before-any-change | Thin wrapper over home screen |
| `src/games/vampires/modules/home/components/MainScreen.tsx` | landing / entry | medium | react-table-edit-protocol | Character/room selection |
| `src/games/vampires/modules/home/module-definition.ts` | home Hub module contract | low | before-any-change | `users`, `characters`, home localStorage |

## Table module (`src/games/vampires/modules/table/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/table/GameTable.tsx` | room orchestrator (~2.6k lines) | **critical** | react-table-edit-protocol | Do not grow it; extract to child components/hooks |
| `src/games/vampires/modules/table/TableRoute.tsx` | `/vampires/table` entry + bootstrap | low | before-any-change | Thin wrapper |
| `src/games/vampires/modules/table/components/{RollHistoryPanel,LayerContextMenuPanel,MediaPreviewModal}.tsx` | extracted UI slices | medium | react-table-edit-protocol | Roll rail, context menu, media preview |
| `src/games/vampires/modules/table/components/{canvas,panels,scenes,layers,media,master}/*` | table UI panels | medium–high | react-table-edit-protocol | Canonical table UI |
| `src/games/vampires/modules/table/types.ts` | table data model (canonical) | high | react-table-edit-protocol | Chat types re-exported from `src/games/vampires/modules/chat/types` |
| `src/games/vampires/modules/table/constants.ts` | table/bucket names, keys (canonical) | **critical** | supabase-edit-protocol | Includes `constants/roll-traits.ts` |
| `src/games/vampires/modules/table/mappers.ts` | DB ↔ app mapping (canonical) | high | supabase-edit-protocol | |
| `src/games/vampires/modules/table/rules-subset.ts` | generated compact rules subset for table mappers/fallbacks | medium | rules-data subsystem | Do not edit manually; regenerate from `public/vampires/rules.json` with `src/games/vampires/scripts/generate-table-rules-subset.ts` |
| `src/games/vampires/modules/table/utils/*` | scene/layer/media/roll helpers (canonical) | medium | react-table-edit-protocol | |
| `src/games/vampires/modules/table/api/*` | Supabase API (scene/layer/roll/character) | high | supabase-edit-protocol | Wired from `GameTable.tsx` |
| `src/games/vampires/modules/table/hooks/*` | room/rolls/scenes/layers/realtime | high | react-table-edit-protocol | Wired in `GameTable.tsx` |
| `src/games/vampires/modules/table/components/*` | modals + roll UI slices | medium | react-table-edit-protocol | See `components/README.md` |
| `src/games/vampires/modules/table/index.ts` | public module barrel | low | before-any-change | |

## Master console (`src/games/vampires/modules/master-console/*`)

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/master-console/MasterConsoleRoute.tsx` | room validation, Hub bootstrap and compatibility access gate | medium | before-any-change | URL role never bypasses gate |
| `src/games/vampires/modules/master-console/MasterConsoleShell.tsx` | desktop shell + detached mode | medium | before-any-change | Does not import `GameTable` |
| `src/games/vampires/modules/master-console/components/*` | topbar, sidebar, palette, right rail, host | low | before-any-change | Right rail mounts master-rolls |
| `src/games/vampires/modules/master-console/search/*` | deep-link parser, search fan-out, commands | medium | before-any-change | Providers live in modules |
| `src/games/vampires/modules/master-console/multi-window/*` | BroadcastChannel bus, openDetached | medium | before-any-change | No state snapshots on bus |
| `src/games/vampires/modules/master-console/layouts/*` | layout schema migration + version conflict | high | supabase-edit-protocol | Geometry not in layout_json |
| `src/games/vampires/modules/master-rolls/*` | permanent master roller, hidden roll API, undo | high | supabase-edit-protocol | Same RollMessage as `/vampires/table` |
| `src/games/vampires/modules/master-overview/*` | Night overview command center | medium | before-any-change | Aggregates actors/scenes/logs |
| `src/games/vampires/modules/master-scenes/*` | Master scenes/layers shell | high | supabase-edit-protocol | Reuses table scene APIs; no GameTable |
| `src/games/vampires/modules/lore/*` | Chronicle lore + random tables | high | supabase-edit-protocol | System ref via src/games/vampires/modules/reference |
| `src/games/vampires/modules/blood-bonds/*` | Blood bond graph/list/detail | high | supabase-edit-protocol | VTM rules in core adapter |
| `src/games/vampires/modules/session-log/*` | Master session journal (not player diary) | high | supabase-edit-protocol | Draft vs published tables |
| `src/games/vampires/core/vtm5/rules/blood-bonds/*` | Pure bond level/drink/warning rules | high | vtm-mechanics-edit-protocol | No React |
| `src/games/vampires/modules/master-console/contributions.ts` | static contribution registry | medium | before-any-change | Allow-listed module ids only |
| `src/games/vampires/modules/master-console/{types,module-definition,bootstrap}.ts` | Hub + UI contribution contracts | medium | before-any-change | Contribution types not in src/platform/hub |
| `src/games/vampires/modules/master-console/persistence/*` | master table constants, types, mappers and validation | high | supabase-edit-protocol | Canonical persistence contract |
| `src/games/vampires/modules/master-console/api/*` | membership-gated Supabase reads/writes | high | supabase-edit-protocol | RLS is the authority |
| `src/games/vampires/modules/master-console/hooks/*` | room-filtered master-only Realtime state | high | supabase-edit-protocol | Stable channel keys; cleanup on teardown |

## Character sheet module (`src/games/vampires/modules/character-sheet/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/character-sheet/CharacterSheetRoute.tsx` | `/vampires/character-sheet` entry | low | before-any-change | Thin wrapper |
| `src/games/vampires/modules/character-sheet/components/CharacterSheetScreen.tsx` | iframe shell + nav | **high** | legacy-edit-protocol | Bridge contract owner |
| `src/games/vampires/modules/character-sheet/legacy/{params,events,bridge}.ts` | bridge contract (canonical) | **high** | legacy-edit-protocol | Params, postMessage, localStorage |

## Actors (`src/games/vampires/modules/actors/*`)

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/actors/types.ts` | actor kinds, compact/linked and public/private contracts | high | supabase-edit-protocol | `characters` remains linked source of truth |
| `src/games/vampires/modules/actors/api/*` | actor CRUD, hydration, link/unlink, clone and bulk RPC | high | supabase-edit-protocol | UI-independent |
| `src/games/vampires/modules/actors/services/*` | normalization, vitals/pools, bulk actions, conversion | high | vtm-mechanics-edit-protocol | Must strip GM-private fields |
| `src/games/vampires/modules/actors/hooks/*` | room/linked-sheet Realtime hydration | high | supabase-edit-protocol | Cleanup every channel |
| `src/games/vampires/modules/actors/components/*` | Master «НПС и SPC» table + detail card | medium | before-any-change | No GameTable import |
| `src/games/vampires/modules/actors/utils/*` | filters, sort, templates, labels, saved filters | low | before-any-change | Templates are data |
| `src/games/vampires/modules/actors/contribution.ts` | MasterConsoleContribution for actors | low | before-any-change | Registered in master-console |

## Chat, music, journal, reference
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/rules-chat/*` | Rules assistant UI, library-chronicle selection, local journal/reference context | high | supabase-edit-protocol | DB retrieval is delegated to authenticated Edge tools |
| `src/games/vampires/modules/chronicle-library/*` | Private official/personal chronicle reader, membership, resumable player transcript pipeline and Storyteller ingest | high | supabase-edit-protocol | Personal jobs/documents stay owner-only; reuses reference renderer |
| `src/games/vampires/supabase/functions/librarian-chat/*` | DeepSeek tool loop over owner sheets, books and authorized official/personal game history | **critical** | supabase-edit-protocol | Keep `verify_jwt`; no general SQL tool |
| `src/games/vampires/supabase/functions/personal-chronicle-processor/*` | Bounded DeepSeek cleanup/summary operations for owner transcript jobs | **critical** | supabase-edit-protocol | Keep `verify_jwt`; caller JWT + RLS only; every chunk must persist |
| `src/games/vampires/supabase/library_chronicles.sql` | Private library chronicle membership, RLS, FTS and atomic document upload RPC | **critical** | supabase-edit-protocol | Separate from master `chronicle_members`; no private text in Git |
| `src/games/vampires/supabase/personal_chronicles.sql` | Owner-only transcript jobs, final documents, RLS, FTS and atomic completion RPC | **critical** | supabase-edit-protocol | Chronicle ID groups data but never grants other members access |
| `src/games/vampires/modules/chat/module-definition.ts` | chat Hub module contract | low | before-any-change | `table_chat_messages` persistence |
| `src/games/vampires/modules/chat/components/ChatPanel.tsx` | chat UI | medium | react-table-edit-protocol | `table_chat_messages` |
| `src/games/vampires/modules/chat/hooks/useChat.ts` | chat state/auth/realtime | high | react-table-edit-protocol + supabase-edit-protocol | Supabase realtime + localStorage user |
| `src/games/vampires/modules/chat/api/chat-api.ts` | chat Supabase API/mappers | high | supabase-edit-protocol | Do not rename `table_chat_messages` |
| `src/games/vampires/modules/music/module-definition.ts` | music Hub module contract | low | before-any-change | `table_music`, `table_music_library`, `table_scene_music`, `table-music` |
| `src/games/vampires/modules/music/components/MusicPlayer.tsx` | music UI | medium | react-table-edit-protocol | |
| `src/games/vampires/modules/music/components/GlobalMusicEngineMount.tsx` | persistent hidden music mount | medium | react-table-edit-protocol | Mounted by `src/app/(vampires)/vampires/layout.tsx`; keep stable across VTM navigation |
| `src/games/vampires/modules/music/MusicSyncEngine.ts` | music sync | high | react-table-edit-protocol | Realtime sync + autoplay limits |
| `src/games/vampires/modules/music/adapters/{localAudioAdapter,youtubeAdapter}.ts` | playback adapters | medium | react-table-edit-protocol | Browser/YouTube limits |
| `src/games/vampires/modules/journal/*` | TipTap journal (canonical) | medium | before-any-change | |
| `src/games/vampires/modules/reference/*` | markdown reference (canonical) | low | before-any-change | |

## Shared UI theme

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/modules/ui/vtm-theme/*` | Canonical VTM UI tokens and scoped shared controls | medium | before-any-change | Apply `VTM_THEME_CLASS`; keep feature selectors in their owning module |

## VTM mechanics (`src/games/vampires/core/vtm5/rules/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/core/vtm5/rules/health/index.ts` | health/damage tracker | **critical** | vtm-mechanics-edit-protocol | Legacy dup: `public/vampires/vtm-health.js` |
| `src/games/vampires/core/vtm5/rules/humanity/index.ts` | humanity/stains/remorse | **critical** | vtm-mechanics-edit-protocol | Legacy dup: `public/vampires/vtm-humanity.js` |
| `src/games/vampires/core/vtm5/rules/damage/index.ts` | damage helpers | high | vtm-mechanics-edit-protocol | |
| `src/games/vampires/core/vtm5/rules/derived-stats/index.ts` | derived stats | high | vtm-mechanics-edit-protocol | |
| `src/games/vampires/core/vtm5/rules/disciplines/*` | discipline engine | high | vtm-mechanics-edit-protocol | Run discipline scripts after edits |

## i18n & Supabase client
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/lib/i18n/LanguageProvider.tsx` | RU/EN provider (`useLang`, `t`) | medium | before-any-change | |
| `src/games/vampires/lib/i18n/dictionary.ts` | UI strings | low | before-any-change | |
| `src/games/vampires/lib/i18n/ruleNames.ts` | display name ↔ stable id | high | before-any-change | Compare IDs, not display names |
| `src/games/vampires/lib/supabase.ts` | React Supabase client | high | supabase-edit-protocol | |

## Supabase schema

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `src/games/vampires/supabase/master_console_persistence.sql` | Auth membership and master-only persistence/RLS | **critical** | supabase-edit-protocol | Pending deploy; no client room self-claim |
| `src/games/vampires/supabase/chronicle_actors.sql` | linked/compact actor schema, private fields and bulk RPC | **critical** | supabase-edit-protocol | Depends on master console foundation |
| `src/games/vampires/supabase/master_hidden_rolls.sql` | master-only hidden roll storage + reveal | **critical** | supabase-edit-protocol | Not on player realtime; not table_rolls |
| `src/games/vampires/supabase/master_overview.sql` | session notes + plot hooks (master RLS) | **critical** | supabase-edit-protocol | Local fallback when undeployed |
| `src/games/vampires/supabase/master_scenes.sql` | scene meta, interactives, public projection | **critical** | supabase-edit-protocol | Does not replace table_scenes |
| `src/games/vampires/supabase/chronicle_lore.sql` | lore categories/entries/private notes/tables | **critical** | supabase-edit-protocol | No rules.json copy |
| `src/games/vampires/supabase/blood_bonds.sql` | blood_bonds + append-only events | **critical** | supabase-edit-protocol | Master RLS; no event DELETE |

## Legacy (`public/vampires/`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `public/vampires/old-sheet.html` | legacy sheet markup/styles (~5k) | **critical** | legacy-edit-protocol | |
| `public/vampires/main.js` | legacy sheet logic (~11k) | **critical** | legacy-edit-protocol | Watch global vars |
| `public/vampires/supabase.js` | legacy Supabase + character CRUD | **critical** | supabase-edit-protocol | `characters` table |
| `public/vampires/vtm-health.js` | legacy health | **critical** | vtm-mechanics-edit-protocol | Sync with `src/games/vampires/core/vtm5/rules/health/index.ts` |
| `public/vampires/vtm-humanity.js` | legacy humanity | **critical** | vtm-mechanics-edit-protocol | Sync with `src/games/vampires/core/vtm5/rules/humanity/index.ts` |
| `public/vampires/creation-wizard.js` | character creation | high | legacy-edit-protocol | |
| `public/vampires/i18n-runtime.js` | legacy i18n runtime | high | legacy-edit-protocol | |
| `public/vampires/i18n-dictionary.js` | legacy i18n strings | medium | legacy-edit-protocol | |
| `public/vampires/rules.json` | rules data (RU, ~34k) | **critical** | see rules-data subsystem | Data layer, no UI logic |
| `public/vampires/rules_eng.json` | rules data (EN) | **critical** | see rules-data subsystem | Keep in sync with RU |

## Scripts
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `tooling/audit-project-structure.ts` | `npm run audit:structure` | low | before-any-change | Structure/duplication audit |
| `src/games/vampires/scripts/audit-discipline-rules.ts` | `npm run audit:disciplines` | low | before-any-change | Discipline rules audit |
| `src/games/vampires/scripts/validate-discipline-mechanics.ts` | `npm run validate:disciplines` | low | before-any-change | Mechanics validation |
| `src/games/vampires/scripts/test-discipline-engine.ts` | `npm run test:disciplines` | low | before-any-change | Engine tests |
| `src/games/vampires/scripts/test-vtm-legacy-parity.ts` | `npm run test:vtm-parity` | low | vtm-mechanics-edit-protocol | health/humanity legacy ↔ core parity |
| `src/games/vampires/scripts/generate-table-rules-subset.ts` | manual generator for `src/games/vampires/modules/table/rules-subset.ts` | low | rules-data subsystem | Run after passive tracker/damage discipline mechanics change |

> Workflows referenced above live in `docs/ai/workflows/`. "before-any-change" is
> the general checklist; the others are area-specific protocols.
