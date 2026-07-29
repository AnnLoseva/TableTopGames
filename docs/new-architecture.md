# Новая архитектура проекта

> Актуальный справочник по целевой модели **Infrastructure → Hub → Game Systems → Modules**.
> Детальный миграционный план и legacy-контракты — в [`architecture.md`](./architecture.md).
> Карта runtime для агентов — в [`ai/ARCHITECTURE-MAP.md`](./ai/ARCHITECTURE-MAP.md).

Проект — живой VTM V5 character sheet + online game table. Архитектура вырастает
вокруг работающего legacy-листа и React-стола **маленькими проверяемыми шагами**.
Ни один рефакторинг не должен ломать маршруты, Supabase-схему, iframe-bridge или
сохранённые данные.

---

## Четыре слоя

| Слой | Папка | Ответственность | Не должен знать |
|------|-------|-----------------|-----------------|
| **Infrastructure** | `core/infrastructure/` | Низкоуровневые контракты: result types, ids, clocks, logging, storage abstractions | VTM-правила, React, feature-модули |
| **Hub** | `core/hub/` | Хроники, регистрация систем и модулей, game-neutral contracts | Правила конкретной игры, Supabase feature-запросы |
| **Game Systems** | `games/{game}/core/{id}/` | Чистые правила + адаптеры для модулей | React, DOM, Supabase |
| **Modules** | `games/vampires/modules/{id}/` | UI, hooks, API, realtime, storage конкретной фичи | Правила других игровых систем |

Дополнительные зоны (не слои Hub, но важны):

- **`app/(vampires)/`** — URL-neutral VTM route group and providers.
- **`app/pathfinder2/`** — isolated Pathfinder route shells.
- **`games/vampires/lib/`** — VTM Supabase client and i18n.
- **`public/vampires/`** — legacy VTM character sheet and assets (vanilla JS, iframe).

---

## Диаграмма связей

```text
┌─────────────────────────────────────────────────────────────────┐
│  app/layout.tsx + game-owned route groups (route shells)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  core/hub/                                                      │
│  game-neutral chronicle/module/system registry contracts        │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
┌────────────▼────────────┐    ┌─────────────▼────────────────────┐
│  games/vampires/core/   │    │  games/vampires/modules/        │
│  VTM preset + bootstrap │    │  table, chat, music, rolls,      │
│  vtm5/rules/* (pure TS) │    │  master-console + 6 feature mods │
│  vtm5/adapters/*        │───►│  api/, hooks/, components/       │
│  createVtm5SystemCore() │    │                                 │
└─────────────────────────┘    └──────────────┬───────────────────┘
                                              │
┌─────────────────────────────────────────────▼───────────────────┐
│  core/infrastructure/  (placeholder)                              │
│  games/vampires/lib/supabase.ts, games/vampires/lib/i18n/*    │
└───────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Supabase + public/vampires/ legacy sheet and assets            │
└─────────────────────────────────────────────────────────────────┘
```

### Поток bootstrap хроники VTM5

```text
createVtm5ChronicleHub()
  → регистрирует Vtm5System + module definitions
    (home, table, chat, music, rolls, character-sheet, journal, reference)

bootstrapChronicleRuntime(hub, chronicle)
  → hub.resolveModulesForChronicle(chronicle)
  → createVtm5SystemCore()
  → configureTableModule(vtm5.adapters.table)
  → configureRollsModule(vtm5.adapters.rolls)
  → ChronicleRuntime { chronicle, resolved, adapters }
```

**Runtime:** `app/(vampires)/table/page.tsx` → `TableRoute` → `bootstrapTableForRoom(room)` →
`GameTable`. Адаптеры VTM5 активны до монтирования оркестратора.

---

## Game System Core (VTM5)

Путь: `games/vampires/core/vtm5/`

| Часть | Содержимое | Статус |
|-------|------------|--------|
| `rules/*` | health, humanity, damage, derived-stats, disciplines | ✅ перенесено, pure TS |
| `adapters/table.ts` | health, derived stats, discipline roll effects | ✅ реализовано |
| `adapters/rolls.ts` | willpower reroll eligibility | ✅ реализовано |
| `system-core.ts` | `createVtm5SystemCore()` — система + адаптеры | ✅ реализовано |

Правила core:

- без React, DOM, `window`, Supabase, Next.js;
- UI вызывает core (через адаптеры), core не вызывает UI;
- legacy-дубликаты (`public/vampires/vtm-health.js`, `public/vampires/vtm-humanity.js`) синхронизировать осознанно.

---

## Hub

Путь: `core/hub/`

| Файл | Назначение |
|------|------------|
| `types.ts` | `GameSystem`, `Module`, `Chronicle`, `ModuleRegistration`, `ChronicleHub` |
| `registry.ts` | `createHubRegistry()` — регистрация и резолв модулей |
| `hub.ts` | `createChronicleHub()` |

Hub не содержит VTM-правил и не делает Supabase-запросов.
VTM-specific preset and adapter wiring live in
`games/vampires/core/{presets,chronicle-runtime}.ts`.

---

## Modules

| Модуль | Путь | Lifecycle | Что перенесено |
|--------|------|-----------|----------------|
| **home** | `games/vampires/modules/home/` | active | HomeRoute, MainScreen, module-definition |
| **table** | `games/vampires/modules/table/` | active | types, constants, mappers, utils, api/*, hooks/*, components (modals, controls), system-adapter, configure |
| **chat** | `games/vampires/modules/chat/` | active | api, hooks, ChatPanel |
| **music** | `games/vampires/modules/music/` | active | player, sync engine, adapters (YouTube, local audio), global mount |
| **rolls** | `games/vampires/modules/rolls/` | active | utils, hooks, DiceRollOverlay, system-adapter, configure |
| **character-sheet** | `games/vampires/modules/character-sheet/` | active | legacy bridge, CharacterSheetRoute, screen component |
| **journal** | `games/vampires/modules/journal/` | active | JournalRoute, JournalPage, JournalPanel, editor |
| **reference** | `games/vampires/modules/reference/` | active | ReferenceRoute, ReferencePage, sidebar, markdown |

### Контракт модуля

Каждый модуль описывается через `Module` из `@/core/hub`:

- `id`, `name`, `lifecycle`
- `supportedSystems` — например `['vtm5']`
- `capabilities` — `table`, `rolls`, `chat`, `music`, …
- `routes`, `persistence`, `browser` — опциональные контракты

Модули с игровой механикой принимают адаптер от системы:

```ts
// games/vampires/modules/table
configureTableModule(adapter: TableSystemAdapter)

// games/vampires/modules/rolls
configureRollsModule(adapter: RollsSystemAdapter)
```

---

## Правила разработки новых модулей

1. **Создать границу до переноса кода** — `types.ts`, `module-definition.ts`, README.
2. **Определить `ModuleRegistration`** и зарегистрировать в Hub preset или `createChronicleHub({ modules: [...] })`.
3. **Если модуль использует правила игры** — описать `*SystemAdapter` в модуле; реализацию положить в `games/{game}/core/{id}/adapters/`.
4. **Supabase I/O** — только в `games/vampires/modules/{id}/api/`, через constants + mappers модуля.
5. **React state** — в `games/vampires/modules/{id}/hooks/`, не в route shells.
6. **UI** — в `games/vampires/modules/{id}/components/`; route shell импортирует один entry-компонент.
7. **Не импортировать** `@/games/vampires/core/vtm5/rules/*` напрямую, если есть адаптер (целевое правило; table пока на переходе).
8. **Удалённые старые пути** — после переноса не добавлять новые re-export shim’ы без отдельной задачи на совместимость.
9. **Проверки** — `npm run lint` + `npm run build` после каждого значимого шага.
10. **Не менять** Supabase table/bucket names и shape сохранённых данных без migration note.

### Шаблон нового модуля

```text
games/vampires/modules/my-feature/
  types.ts              # MyFeatureModule = Module<'my-feature', 'vtm5'>
  module-definition.ts  # myFeatureModuleDefinition
  system-adapter.ts     # (если нужны правила игры)
  configure.ts          # configureMyFeatureModule()
  api/
  hooks/
  components/
  index.ts
```

---

## Правила добавления новых игровых систем

1. **Создать** отдельный game domain и `games/{game}/core/{systemId}/` с `types.ts`, `rules/`, `adapters/`.
2. **Зарегистрировать** `GameSystem` в Hub: `{ id, name, version?, rulesNamespace }`.
3. **Реализовать адаптеры** под контракты существующих модулей (`TableSystemAdapter`, `RollsSystemAdapter`, …).
4. **Экспортировать** `create{SystemId}SystemCore()` по образцу `createVtm5SystemCore()`.
5. **Добавить game-specific preset** рядом с системой, не в shared `core/hub/`.
6. **Расширить game-specific runtime bootstrap** веткой для нового `systemId`.
7. **Обновить** `supportedSystems` в module definitions затронутых модулей.
8. **Не трогать** VTM5 rules при добавлении другой системы — использовать новый game domain.

---

## Текущий статус миграции (2026-07-29)

### ✅ Сделано

| Область | Детали |
|---------|--------|
| VTM5 rules core | `games/vampires/core/vtm5/rules/*` — health, humanity, damage, derived-stats, disciplines |
| VTM5 adapters | table + rolls адаптеры, `createVtm5SystemCore()` |
| Hub foundation | shared registry + `createChronicleHub`; VTM preset/bootstrap in `games/vampires/core/*` |
| Table module | api (scene, layer, roll, character, music, realtime), hooks (session, scenes, layers, rolls, realtime), utils, key components |
| Table Supabase | все table-запросы вынесены из `GameTable.tsx` в `games/vampires/modules/table/api/` |
| Chat module | api, hooks, ChatPanel |
| Music module | player, sync, adapters, global engine mount |
| Home module | HomeRoute, MainScreen, module-definition |
| Rolls scaffold | types, adapter contract, configure, module-definition |
| Сборка | `npm run build` и `npm run lint` проходят |

### 🟡 В процессе / переходное

| Область | Детали |
|---------|--------|
| `games/vampires/modules/table/GameTable.tsx` | ~2.8k строк — оркестратор; UI-панели в `games/vampires/modules/table/components/*` |
| Прямые импорты VTM5 в GameTable | только `import type`; runtime — через adapters |
| Character state helpers | ✅ `games/vampires/modules/table/utils/character-state.ts` |
| Rolls factory | ✅ `games/vampires/modules/rolls/hooks/useQuickRollFactory.ts` |
| Hub preset | ✅ home + table + chat + music + rolls + character-sheet + journal + reference |
| Infrastructure | `core/infrastructure/` — placeholder |
| Legacy iframe (`public/vampires/main.js`) | не мигрирован; bridge в `games/vampires/modules/character-sheet/legacy/` |

### ⬜ Не начато / позже

| Область | Детали |
|---------|--------|
| Voice WebRTC hook | в `GameTable.tsx` |
| Master reveals / whispers API | будущий `master-api` |
| Полный rolls UI module | отделение от table |
| React character sheet | замена legacy iframe |
| Синхронизация legacy JS | `public/vampires/vtm-health.js` ↔ TS core |
| DI / runtime registry | полноценная оркестрация Hub |

---

## Legacy-зона (не трогать широкими PR)

```text
/character-sheet → CharacterSheetScreen → iframe /vampires/old-sheet.html
  → public/vampires/main.js, public/vampires/supabase.js, public/vtm-*.js
  ← postMessage { type: 'vtm-character-saved', characterId }
```

Маршруты `/`, `/character-sheet`, `/table`, `/journal`, `/reference` — стабильны.
`app/(vampires)/table/page.tsx` по-прежнему рендерит `GameTable` без изменений контракта.

---

## Проверки после архитектурных изменений

```bash
npm run lint    # tsc --noEmit
npm run build   # next build
```

Дополнительно для VTM-механик:

```bash
npm run audit:disciplines
npm run validate:disciplines
npm run test:disciplines
```

Ручная smoke-проверка UI:

- `/table?room=campaign-666&role=master` и `role=player`
- `/character-sheet`, `/character-sheet?new=1`
- `/journal`, `/reference`

---

## Связанные документы

- [`architecture.md`](./architecture.md) — полный миграционный план, legacy-контракты, Definition of Done
- [`ai/CURRENT-STATE.md`](./ai/CURRENT-STATE.md) — краткий статус для агентов
- [`ai/ARCHITECTURE-MAP.md`](./ai/ARCHITECTURE-MAP.md) — runtime-карта файлов
- [`core/hub/README.md`](../core/hub/README.md) — границы Hub
- [`games/vampires/modules/table/README.md`](../games/vampires/modules/table/README.md) — статус table module
