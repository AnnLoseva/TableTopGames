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
| `app/(vampires)/page.tsx` | `/` route → `games/vampires/modules/home/HomeRoute` | low | before-any-change | Thin wrapper |
| `app/(vampires)/character-sheet/page.tsx` | `/character-sheet` route | low | before-any-change | Thin wrapper |
| `app/(vampires)/table/page.tsx` | `/table` route | low | before-any-change | Thin wrapper |
| `app/(vampires)/master/page.tsx` | `/master` route | low | before-any-change | Thin wrapper; explicit `room` required |
| `app/(vampires)/layout.tsx` | VTM-only providers, metadata, theme and persistent music mount | medium | before-any-change | Route group does not change URLs |
| `app/pathfinder2/sheet/page.tsx` | `/pathfinder2/sheet` route | low | before-any-change | Thin wrapper; intentionally unlinked from `/` |
| `app/(vampires)/old/page.tsx` | legacy redirect | low | before-any-change | Redirects to `/character-sheet` |

## Game domain boundaries (`games/*`)

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/core/*` | VTM Hub preset/runtime and V5 rules | high | vtm-mechanics-edit-protocol | Shared Hub types stay in `core/hub/*` |
| `games/vampires/modules/*` | VTM feature domains and route entries | medium–critical | subsystem workflow | Do not place Pathfinder code here |
| `games/vampires/lib/*` | VTM i18n and Supabase client | high | subsystem workflow | VTM-only |
| `games/vampires/styles/*` | VTM global theme loaded by the VTM route group | medium | before-any-change | Keep Pathfinder styling isolated |
| `games/pathfinder2/sheet/Pathfinder2SheetRoute.tsx` | Pathfinder 2 route entry | low | before-any-change | Thin wrapper |
| `games/pathfinder2/sheet/components/*` | Six-step Pathfinder 2 creator UI | medium | before-any-change | Local-only, no Supabase |
| `games/pathfinder2/sheet/{data,types}.ts` | Starter character-creation model and options | medium | before-any-change | Independent from VTM rules data |
| `games/pathfinder2/sheet/rules-source.ts` | Short rule guides + pf2.ru search links | medium | before-any-change | Do not scrape or vendor full site content |

## Home module (`games/vampires/modules/home/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/home/HomeRoute.tsx` | `/` entry | low | before-any-change | Thin wrapper over home screen |
| `games/vampires/modules/home/components/MainScreen.tsx` | landing / entry | medium | react-table-edit-protocol | Character/room selection |
| `games/vampires/modules/home/module-definition.ts` | home Hub module contract | low | before-any-change | `users`, `characters`, home localStorage |

## Table module (`games/vampires/modules/table/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/table/GameTable.tsx` | room orchestrator (~2.6k lines) | **critical** | react-table-edit-protocol | Do not grow it; extract to child components/hooks |
| `games/vampires/modules/table/TableRoute.tsx` | `/table` entry + bootstrap | low | before-any-change | Thin wrapper |
| `games/vampires/modules/table/components/{RollHistoryPanel,LayerContextMenuPanel,MediaPreviewModal}.tsx` | extracted UI slices | medium | react-table-edit-protocol | Roll rail, context menu, media preview |
| `games/vampires/modules/table/components/{canvas,panels,scenes,layers,media,master}/*` | table UI panels | medium–high | react-table-edit-protocol | Canonical table UI |
| `games/vampires/modules/table/types.ts` | table data model (canonical) | high | react-table-edit-protocol | Chat types re-exported from `games/vampires/modules/chat/types` |
| `games/vampires/modules/table/constants.ts` | table/bucket names, keys (canonical) | **critical** | supabase-edit-protocol | Includes `constants/roll-traits.ts` |
| `games/vampires/modules/table/mappers.ts` | DB ↔ app mapping (canonical) | high | supabase-edit-protocol | |
| `games/vampires/modules/table/rules-subset.ts` | generated compact rules subset for table mappers/fallbacks | medium | rules-data subsystem | Do not edit manually; regenerate from `public/vampires/rules.json` with `games/vampires/scripts/generate-table-rules-subset.ts` |
| `games/vampires/modules/table/utils/*` | scene/layer/media/roll helpers (canonical) | medium | react-table-edit-protocol | |
| `games/vampires/modules/table/api/*` | Supabase API (scene/layer/roll/character) | high | supabase-edit-protocol | Wired from `GameTable.tsx` |
| `games/vampires/modules/table/hooks/*` | room/rolls/scenes/layers/realtime | high | react-table-edit-protocol | Wired in `GameTable.tsx` |
| `games/vampires/modules/table/components/*` | modals + roll UI slices | medium | react-table-edit-protocol | See `components/README.md` |
| `games/vampires/modules/table/index.ts` | public module barrel | low | before-any-change | |

## Master console (`games/vampires/modules/master-console/*`)

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/master-console/MasterConsoleRoute.tsx` | room validation, Hub bootstrap and compatibility access gate | medium | before-any-change | URL role never bypasses gate |
| `games/vampires/modules/master-console/MasterConsoleShell.tsx` | desktop shell + detached mode | medium | before-any-change | Does not import `GameTable` |
| `games/vampires/modules/master-console/components/*` | topbar, sidebar, palette, right rail, host | low | before-any-change | Right rail mounts master-rolls |
| `games/vampires/modules/master-console/search/*` | deep-link parser, search fan-out, commands | medium | before-any-change | Providers live in modules |
| `games/vampires/modules/master-console/multi-window/*` | BroadcastChannel bus, openDetached | medium | before-any-change | No state snapshots on bus |
| `games/vampires/modules/master-console/layouts/*` | layout schema migration + version conflict | high | supabase-edit-protocol | Geometry not in layout_json |
| `games/vampires/modules/master-rolls/*` | permanent master roller, hidden roll API, undo | high | supabase-edit-protocol | Same RollMessage as `/table` |
| `games/vampires/modules/master-overview/*` | Night overview command center | medium | before-any-change | Aggregates actors/scenes/logs |
| `games/vampires/modules/master-scenes/*` | Master scenes/layers shell | high | supabase-edit-protocol | Reuses table scene APIs; no GameTable |
| `games/vampires/modules/lore/*` | Chronicle lore + random tables | high | supabase-edit-protocol | System ref via games/vampires/modules/reference |
| `games/vampires/modules/blood-bonds/*` | Blood bond graph/list/detail | high | supabase-edit-protocol | VTM rules in core adapter |
| `games/vampires/modules/session-log/*` | Master session journal (not player diary) | high | supabase-edit-protocol | Draft vs published tables |
| `games/vampires/core/vtm5/rules/blood-bonds/*` | Pure bond level/drink/warning rules | high | vtm-mechanics-edit-protocol | No React |
| `games/vampires/modules/master-console/contributions.ts` | static contribution registry | medium | before-any-change | Allow-listed module ids only |
| `games/vampires/modules/master-console/{types,module-definition,bootstrap}.ts` | Hub + UI contribution contracts | medium | before-any-change | Contribution types not in core/hub |
| `games/vampires/modules/master-console/persistence/*` | master table constants, types, mappers and validation | high | supabase-edit-protocol | Canonical persistence contract |
| `games/vampires/modules/master-console/api/*` | membership-gated Supabase reads/writes | high | supabase-edit-protocol | RLS is the authority |
| `games/vampires/modules/master-console/hooks/*` | room-filtered master-only Realtime state | high | supabase-edit-protocol | Stable channel keys; cleanup on teardown |

## Character sheet module (`games/vampires/modules/character-sheet/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/character-sheet/CharacterSheetRoute.tsx` | `/character-sheet` entry | low | before-any-change | Thin wrapper |
| `games/vampires/modules/character-sheet/components/CharacterSheetScreen.tsx` | iframe shell + nav | **high** | legacy-edit-protocol | Bridge contract owner |
| `games/vampires/modules/character-sheet/legacy/{params,events,bridge}.ts` | bridge contract (canonical) | **high** | legacy-edit-protocol | Params, postMessage, localStorage |

## Actors (`games/vampires/modules/actors/*`)

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/actors/types.ts` | actor kinds, compact/linked and public/private contracts | high | supabase-edit-protocol | `characters` remains linked source of truth |
| `games/vampires/modules/actors/api/*` | actor CRUD, hydration, link/unlink, clone and bulk RPC | high | supabase-edit-protocol | UI-independent |
| `games/vampires/modules/actors/services/*` | normalization, vitals/pools, bulk actions, conversion | high | vtm-mechanics-edit-protocol | Must strip GM-private fields |
| `games/vampires/modules/actors/hooks/*` | room/linked-sheet Realtime hydration | high | supabase-edit-protocol | Cleanup every channel |
| `games/vampires/modules/actors/components/*` | Master «НПС и SPC» table + detail card | medium | before-any-change | No GameTable import |
| `games/vampires/modules/actors/utils/*` | filters, sort, templates, labels, saved filters | low | before-any-change | Templates are data |
| `games/vampires/modules/actors/contribution.ts` | MasterConsoleContribution for actors | low | before-any-change | Registered in master-console |

## Chat, music, journal, reference
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/rules-chat/*` | Rules assistant UI, library-chronicle selection, local journal/reference context | high | supabase-edit-protocol | DB retrieval is delegated to authenticated Edge tools |
| `games/vampires/modules/chronicle-library/*` | Private official/personal chronicle reader, membership, resumable player transcript pipeline and Storyteller ingest | high | supabase-edit-protocol | Personal jobs/documents stay owner-only; reuses reference renderer |
| `games/vampires/supabase/functions/librarian-chat/*` | DeepSeek tool loop over owner sheets, books and authorized official/personal game history | **critical** | supabase-edit-protocol | Keep `verify_jwt`; no general SQL tool |
| `games/vampires/supabase/functions/personal-chronicle-processor/*` | Bounded DeepSeek cleanup/summary operations for owner transcript jobs | **critical** | supabase-edit-protocol | Keep `verify_jwt`; caller JWT + RLS only; every chunk must persist |
| `games/vampires/supabase/library_chronicles.sql` | Private library chronicle membership, RLS, FTS and atomic document upload RPC | **critical** | supabase-edit-protocol | Separate from master `chronicle_members`; no private text in Git |
| `games/vampires/supabase/personal_chronicles.sql` | Owner-only transcript jobs, final documents, RLS, FTS and atomic completion RPC | **critical** | supabase-edit-protocol | Chronicle ID groups data but never grants other members access |
| `games/vampires/modules/chat/module-definition.ts` | chat Hub module contract | low | before-any-change | `table_chat_messages` persistence |
| `games/vampires/modules/chat/components/ChatPanel.tsx` | chat UI | medium | react-table-edit-protocol | `table_chat_messages` |
| `games/vampires/modules/chat/hooks/useChat.ts` | chat state/auth/realtime | high | react-table-edit-protocol + supabase-edit-protocol | Supabase realtime + localStorage user |
| `games/vampires/modules/chat/api/chat-api.ts` | chat Supabase API/mappers | high | supabase-edit-protocol | Do not rename `table_chat_messages` |
| `games/vampires/modules/music/module-definition.ts` | music Hub module contract | low | before-any-change | `table_music`, `table_music_library`, `table_scene_music`, `table-music` |
| `games/vampires/modules/music/components/MusicPlayer.tsx` | music UI | medium | react-table-edit-protocol | |
| `games/vampires/modules/music/components/GlobalMusicEngineMount.tsx` | persistent hidden music mount | medium | react-table-edit-protocol | Mounted by `app/(vampires)/layout.tsx`; keep stable across VTM navigation |
| `games/vampires/modules/music/MusicSyncEngine.ts` | music sync | high | react-table-edit-protocol | Realtime sync + autoplay limits |
| `games/vampires/modules/music/adapters/{localAudioAdapter,youtubeAdapter}.ts` | playback adapters | medium | react-table-edit-protocol | Browser/YouTube limits |
| `games/vampires/modules/journal/*` | TipTap journal (canonical) | medium | before-any-change | |
| `games/vampires/modules/reference/*` | markdown reference (canonical) | low | before-any-change | |

## Shared UI theme

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/modules/ui/vtm-theme/*` | Canonical VTM UI tokens and scoped shared controls | medium | before-any-change | Apply `VTM_THEME_CLASS`; keep feature selectors in their owning module |

## VTM mechanics (`games/vampires/core/vtm5/rules/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/core/vtm5/rules/health/index.ts` | health/damage tracker | **critical** | vtm-mechanics-edit-protocol | Legacy dup: `public/vampires/vtm-health.js` |
| `games/vampires/core/vtm5/rules/humanity/index.ts` | humanity/stains/remorse | **critical** | vtm-mechanics-edit-protocol | Legacy dup: `public/vampires/vtm-humanity.js` |
| `games/vampires/core/vtm5/rules/damage/index.ts` | damage helpers | high | vtm-mechanics-edit-protocol | |
| `games/vampires/core/vtm5/rules/derived-stats/index.ts` | derived stats | high | vtm-mechanics-edit-protocol | |
| `games/vampires/core/vtm5/rules/disciplines/*` | discipline engine | high | vtm-mechanics-edit-protocol | Run discipline scripts after edits |

## i18n & Supabase client
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/lib/i18n/LanguageProvider.tsx` | RU/EN provider (`useLang`, `t`) | medium | before-any-change | |
| `games/vampires/lib/i18n/dictionary.ts` | UI strings | low | before-any-change | |
| `games/vampires/lib/i18n/ruleNames.ts` | display name ↔ stable id | high | before-any-change | Compare IDs, not display names |
| `games/vampires/lib/supabase.ts` | React Supabase client | high | supabase-edit-protocol | |

## Supabase schema

| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `games/vampires/supabase/master_console_persistence.sql` | Auth membership and master-only persistence/RLS | **critical** | supabase-edit-protocol | Pending deploy; no client room self-claim |
| `games/vampires/supabase/chronicle_actors.sql` | linked/compact actor schema, private fields and bulk RPC | **critical** | supabase-edit-protocol | Depends on master console foundation |
| `games/vampires/supabase/master_hidden_rolls.sql` | master-only hidden roll storage + reveal | **critical** | supabase-edit-protocol | Not on player realtime; not table_rolls |
| `games/vampires/supabase/master_overview.sql` | session notes + plot hooks (master RLS) | **critical** | supabase-edit-protocol | Local fallback when undeployed |
| `games/vampires/supabase/master_scenes.sql` | scene meta, interactives, public projection | **critical** | supabase-edit-protocol | Does not replace table_scenes |
| `games/vampires/supabase/chronicle_lore.sql` | lore categories/entries/private notes/tables | **critical** | supabase-edit-protocol | No rules.json copy |
| `games/vampires/supabase/blood_bonds.sql` | blood_bonds + append-only events | **critical** | supabase-edit-protocol | Master RLS; no event DELETE |

## Legacy (`public/vampires/`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `public/vampires/old-sheet.html` | legacy sheet markup/styles (~5k) | **critical** | legacy-edit-protocol | |
| `public/vampires/main.js` | legacy sheet logic (~11k) | **critical** | legacy-edit-protocol | Watch global vars |
| `public/vampires/supabase.js` | legacy Supabase + character CRUD | **critical** | supabase-edit-protocol | `characters` table |
| `public/vampires/vtm-health.js` | legacy health | **critical** | vtm-mechanics-edit-protocol | Sync with `games/vampires/core/vtm5/rules/health/index.ts` |
| `public/vampires/vtm-humanity.js` | legacy humanity | **critical** | vtm-mechanics-edit-protocol | Sync with `games/vampires/core/vtm5/rules/humanity/index.ts` |
| `public/vampires/creation-wizard.js` | character creation | high | legacy-edit-protocol | |
| `public/vampires/i18n-runtime.js` | legacy i18n runtime | high | legacy-edit-protocol | |
| `public/vampires/i18n-dictionary.js` | legacy i18n strings | medium | legacy-edit-protocol | |
| `public/vampires/rules.json` | rules data (RU, ~34k) | **critical** | see rules-data subsystem | Data layer, no UI logic |
| `public/vampires/rules_eng.json` | rules data (EN) | **critical** | see rules-data subsystem | Keep in sync with RU |

## Scripts
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `scripts/audit-project-structure.ts` | `npm run audit:structure` | low | before-any-change | Structure/duplication audit |
| `games/vampires/scripts/audit-discipline-rules.ts` | `npm run audit:disciplines` | low | before-any-change | Discipline rules audit |
| `games/vampires/scripts/validate-discipline-mechanics.ts` | `npm run validate:disciplines` | low | before-any-change | Mechanics validation |
| `games/vampires/scripts/test-discipline-engine.ts` | `npm run test:disciplines` | low | before-any-change | Engine tests |
| `games/vampires/scripts/test-vtm-legacy-parity.ts` | `npm run test:vtm-parity` | low | vtm-mechanics-edit-protocol | health/humanity legacy ↔ core parity |
| `games/vampires/scripts/generate-table-rules-subset.ts` | manual generator for `games/vampires/modules/table/rules-subset.ts` | low | rules-data subsystem | Run after passive tracker/damage discipline mechanics change |

> Workflows referenced above live in `docs/ai/workflows/`. "before-any-change" is
> the general checklist; the others are area-specific protocols.
