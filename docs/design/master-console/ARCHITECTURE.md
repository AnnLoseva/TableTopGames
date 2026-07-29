# Архитектура мастерского пульта

## Route и runtime flow

```text
/master?room=...&layout=...&module=...
  -> app/(vampires)/master/page.tsx (thin wrapper)
  -> games/vampires/modules/master-console/MasterConsoleRoute
  -> server-verified session + chronicle membership
  -> bootstrapChronicleRuntime(createVtm5ChronicleHub(), chronicle)
  -> MasterConsoleProvider (room runtime, permissions, search, commands)
  -> MasterConsoleShell
       -> master contribution registry -> lazy module loader
       -> layout engine -> module windows
       -> shared table/rolls/music/journal APIs (never GameTable)
```

Route создаётся только после security foundation. `room` выбирает scope, но не
даёт доступа. Deep link валидирует membership, layout ownership, contribution,
role/system support и только затем загружает модуль.

## Hub и два разных контракта

`core/hub` остаётся тонким registry runtime-модулей. В него добавляется только
`master-console` как обычный `Module` с route/capability. UI-контракт вкладов
живет в `games/vampires/modules/master-console/types.ts`, потому что `loader`, размеры, команды
и export — React/UI concerns, не общие поля Hub.

```ts
type MasterConsoleContribution = {
  id: string
  title: string
  shortTitle?: string
  icon: string
  order: number
  supportedSystems: readonly string[]
  allowedRoles: readonly ('master' | 'observer')[]
  defaultSize: { width: number; height: number }
  minSize?: { width: number; height: number }
  singleton?: boolean
  detachable?: boolean
  loader: () => Promise<{ default: React.ComponentType<MasterModuleProps> }>
  searchProvider?: MasterSearchProvider
  commandProvider?: MasterCommandProvider
  exportProvider?: MasterExportProvider
  deepLinks?: readonly string[]
}
```

Registry получает contributions из `games/vampires/modules/master-{overview,scenes,rolls}`,
`games/vampires/modules/actors`, `games/vampires/modules/lore`, `games/vampires/modules/blood-bonds`, `games/vampires/modules/session-log`.
Регистрация статична и tree-shake/lazy-load friendly; произвольный module id из
URL не превращается в import path.

## Layout engine и multi-window

`MasterLayout` хранит нормализованные окна: contribution id, instance id,
позицию/размер, z-order, minimized/maximized и module-local view state. Engine
применяет min/default sizes, singleton и desktop bounds; domain data в layout не
кладётся. Local draft допустим для плавного drag, Supabase — источник истины.

Detached window использует `/master?...&module=<id>&instance=<id>&detached=1`.
Состояние данных идёт через Supabase; BroadcastChannel передаёт только ephemeral
focus/geometry hints. Закрытие окна не удаляет модуль из layout автоматически.

## Границы и импорты

Допустимо:

- feature modules -> `master-console` contracts, свои api/hooks/components,
  `games/vampires/modules/table/api|hooks|utils|components/scenes|layers|media`, `games/vampires/modules/rolls`,
  `games/vampires/modules/music`, `games/vampires/modules/journal`, `games/vampires/core/vtm5/adapters`;
- `master-console` -> contribution definitions и shared shell services;
- shared modules не знают о конкретных master feature modules.

Недопустимо:

- любой master module -> `games/vampires/modules/table/GameTable.tsx`;
- component -> hardcoded Supabase table/bucket;
- feature A -> internal api/components feature B (связи идут через entity-link
  contract или console service);
- `core/hub`/VTM rules -> React types, layouts, Supabase queries;
- player route -> master API, master select или master realtime channel.

## Shared room и realtime

Первый extraction PR создаёт `games/vampires/modules/table/runtime` или узкий набор shared room
hooks только там, где текущие hooks нельзя безопасно использовать отдельно.
Общий shared channel/table subscriptions остаются каноническими для published
scene/roll/music. Мастерские таблицы получают отдельные subscriptions после RLS;
каждый select и postgres_changes filter включает chronicle/room scope. Publish
command транзакционно создаёт/обновляет player-safe projection и action-log,
после чего существующий `/table` получает обычное shared событие.

## Матрица требования и владельца

| Требование | Фактическое переиспользование | Недостающее | Планируемый владелец |
|---|---|---|---|
| room bootstrap/VTM adapters | `games/vampires/modules/table/bootstrap.ts`, `games/vampires/core/chronicle-runtime.ts` | VTM route-neutral bootstrap | `master-console` + минимальный shared bootstrap extraction |
| сцены | `table/api/scene-api`, `useTableScenes`, SceneManager | draft/publish contract | `master-scenes` |
| слои/media | `layer-api`, `useTableLayers`, LayerManager, MediaLibrary | GM/private projection, interactive objects | `master-scenes` |
| броски | `games/vampires/modules/rolls`, `table/api/roll-api`, RollHistoryPanel | hidden-roll storage/publish policy | `master-rolls` |
| музыка | `games/vampires/modules/music`, scene music API | console composition only | `master-scenes` / existing `music` |
| персонажи | `character-api`, table mappers/preview | chronicle membership and actor model | `actors` |
| journal | `JournalEditor` | structured timeline/action adapters | `session-log` |
| reference/lore | `games/vampires/modules/reference` renderer/catalog | editable room lore + visibility | `lore` |
| top/search/exports | Hub module definitions provide metadata only | provider registry and permission filtering | `master-console` |
| layouts/windows | none | persistence, geometry engine, detach/deep links | `master-console` |
| macros/undo | roll/action services are reusable operations | registry, confirmation, audit/compensation | `master-console` |
| bonds | character identity + VTM adapters | complete domain/API/UI | `blood-bonds` |
| auth/private realtime | current implementation is insufficient | Supabase Auth, membership, claims/RLS | security foundation |
