# Предварительная модель данных

Foundation SQL создан в `games/vampires/supabase/master_console_persistence.sql`. Все master
сущности используют `chronicle_id` как authoritative scope; `room` сохраняется
как совместимый индексируемый slug и проверяется trigger-ом против `chronicles`.
UUID из Supabase Auth membership, а не строка из URL, определяет право доступа.

| Сущность | Источник истины и связи | Public / private | Realtime | Миграция и RLS |
|---|---|---|---|---|
| `ChronicleSession` | новая таблица; chronicle -> many sessions; current scene | публичны number/night/status и явно published summary; планы private | master subscription; projection event игрокам | backfill rooms -> chronicles; master write, member read только projection |
| `ChronicleActor` | `chronicle_actors`; optional link to existing `characters.id`, otherwise compact stat block | actor metadata/compact data master-only until an explicit projection exists | room-scoped master + linked character ID subscription | partial unique character link; never copy full `characters.data` |
| `ActorPrivateFields` | `chronicle_actor_private`, 1:1 with actor | public отсутствует; secrets/motivation/plans/notes private | только room-scoped master channel | separate RLS table prevents accidental player payload inclusion |
| `MasterMacro` | chronicle + owner/registry key | всё private; published result создаётся отдельно | master only | definition/version/shortcut; master CRUD RLS |
| `MasterLayout` | chronicle + owner; windows JSON versioned | private UI state | owner-only; realtime опционален для multi-window | schema version + bounds migration; owner/master RLS |
| `MasterNote` | chronicle, optional entity links/session | published excerpt отдельно; body private | master only | rich text format/version; master CRUD RLS |
| `LoreCategory` | chronicle tree | label/order publishable по флагу; drafts private | master + public projection | cycle protection; role/status RLS |
| `LoreEntry` | category + author + entity links | explicit published revision public; draft/body private | separate master/public streams | revision/status model; не фильтровать секрет только в React |
| `EntityLink` | typed source/target within chronicle | visibility наследуется от обеих сторон, иначе private | master; public projection only | target validation + no cross-chronicle links; RLS existence checks |
| `BloodBond` | regnant/thrall actor refs | private by default; optional revealed summary | master only | unique active pair/direction rules; master RLS |
| `BloodBondEvent` | append-only child of bond/session | private | master only | immutable insert, corrective event; same chronicle RLS |
| `SessionLogEntry` | `session_log_entries` (master draft: title/body/tags/visibility/status/version) | body private by default; players never SELECT this table | master only (RLS) | optimistic concurrency via `version`; separate from player `vtm-journal:*` |
| `SessionLogPublished` | `session_log_published` projection of published shared entries | only published body at publish time; no private drafts | members read by visibility (`shared_all` / `shared_selected`) | unpublish/archive deletes projection |
| `MasterActionLog` | actor/member + command + target + correlation id | private; no secret copied into shared payload | master only | append-only, retention, undo metadata; no client-forged actor id |
| `SceneInteractiveObject` | existing `table_scenes`/`table_images` ids | trigger/secret/outcome private; revealed effect becomes shared table action | master only until execute/reveal | FK strategy for current text ids; master RLS and transactional execute RPC |

## Existing sources that remain canonical

Published scenes/layers/music/rolls remain in existing `table_*` contracts and
are consumed through their constants/mappers/APIs. `characters` remains the
sheet source of truth. Master drafts must not be added as secret JSON columns to
rows readable by anon: current policies use `using (true)`, and PostgREST/RLS
filters rows, not arbitrary secret fields. Use separate master tables plus an
explicit publish command/projection.

## Common columns and invariants

New domain rows require `id`, `chronicle_id`, `created_at`, `updated_at`, creator
identity from authenticated JWT, and optimistic version where edited. Published
content uses status + published revision/timestamp/actor; changing a draft never
silently changes the player projection. Deletion policy is per entity: action
and bond events are append-only, user content generally soft-deleted where links
or audit require history.

RLS tests must cover anon, unrelated authenticated user, player member,
observer, master and service role for SELECT/INSERT/UPDATE/DELETE plus realtime.
