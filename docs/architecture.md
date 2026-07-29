# Архитектура проекта

> **Обновление (2026-07-02):** актуальная четырёхслойная модель, статус миграции
> и правила для модулей/систем — в [`new-architecture.md`](./new-architecture.md).
> Этот файл сохраняет детальный миграционный план, legacy-контракты и Definition of Done.

Этот проект - живой VTM V5 character sheet + online game table. Его нельзя
переписывать "правильно с нуля": новая архитектура должна вырастать вокруг
работающего legacy-листа и React-стола маленькими проверяемыми шагами.

Целевая модель: **Hub + Game System Cores + Pluggable Modules**.

- **Hub** отвечает за маршруты, навигацию, комнату, роль, провайдеры приложения,
  глобальные браузерные контейнеры и подключение модулей.
- **Game System Core** содержит чистые правила конкретной игры. Для текущего
  проекта это VTM V5 core: броски, здоровье, воля, голод, человечность,
  дисциплины, производные статы, адаптеры правил.
- **Pluggable Modules** - функциональные модули вокруг ядра: стол, лист
  персонажа, музыка, медиа, журнал, справочник, чат, мастерские инструменты.

Главный принцип: сначала выделяется граница и контракт, потом переносится код.
Ни один шаг миграции не должен ломать текущие маршруты, Supabase-схему,
legacy-iframe или сохранённые данные.

## Текущая картина

Проект уже разделён на две зоны:

- `public/vampires/old-sheet.html`, `public/vampires/main.js` и связанные JS-файлы - legacy-лист
  персонажа. Он работает как статическое приложение без сборки и открывается
  внутри iframe.
- `app/`, `components/table/`, `games/vampires/modules/music/`, `components/journal/`,
  `components/reference/`, `lib/table/`, `games/vampires/core/vtm5/` - современная
  React/TypeScript зона.

Важные текущие факты:

- `app/layout.tsx` сейчас является корневой оболочкой: подключает
  `LanguageProvider`, тёмную тему и `GlobalMusicEngineMount` из
  `games/vampires/modules/music/`. Это естественная точка роста Hub, но бизнес-логику туда
  добавлять нельзя.
- Маршруты в `app/*/page.tsx` в основном тонкие и импортируют экран или стол.
  Это правильно: маршруты должны оставаться оболочками.
- `components/table/GameTable.tsx` (~9k строк) - главный оркестратор стола:
  комната, роль, Supabase I/O, realtime, персонажи, броски, чат, сцены, слои,
  медиа, музыка, голос, модальные окна.
- `components/table/*` уже содержит вынесенные панели, но многие из них получают
  длинные списки props из `GameTable.tsx`. Это первый признак, что нужен слой
  hooks/services/context, а не только разнос JSX по файлам.
- `lib/table/` уже хранит типы, константы, мапперы и часть чистых утилит стола.
  Supabase-запросы стола — в `games/vampires/modules/table/api/`; chat — в `games/vampires/modules/chat/api/`; music — в `games/vampires/modules/music/`.
- `games/vampires/core/vtm5/rules/` является ядром правил: health, humanity, damage,
  derived stats, disciplines. Этот слой должен оставаться без React, DOM и
  Supabase.
- Часть VTM-логики ещё живёт внутри `GameTable.tsx`: базовые d10-броски,
  hunger/rouse, willpower helpers, blood surge, сборка пулов, contested rolls.
  Это кандидаты на перенос в VTM core.
- Музыкальные таблицы и bucket сейчас объявлены в `games/vampires/modules/music/utils.ts`,
  а часть table-констант - в `lib/table/constants.ts`. Их можно объединять только
  как перенос констант без переименования реальных таблиц/buckets.

## Архитектурные слои

### 1. Hub

Hub - тонкий слой приложения. Он не знает правил VTM и не хранит feature-логику.

Задачи Hub:

- маршруты Next.js App Router;
- общие провайдеры (`LanguageProvider`, будущие providers комнаты/пользователя);
- навигация между листом, столом, журналом и справочником;
- room/role/session контракты;
- регистрация доступных модулей;
- глобальные браузерные mount points вроде `global-music-engine`.

Hub не должен:

- считать броски или VTM-механику;
- делать ad-hoc Supabase-запросы feature-модулей;
- знать внутреннюю форму сцен, слоёв, дисциплин или legacy-DOM.

### 2. Game System Cores

Game System Core - чистый TypeScript-слой конкретной системы правил. Текущий
runtime core VTM V5 живёт в `games/vampires/core/vtm5/rules/`.

Правила core:

- без React, JSX, DOM, `window`, `localStorage`, Supabase и Next.js imports;
- входные данные -> выходные данные;
- вся логика проверяется через `npm run lint`, discipline-аудиты и focused tests;
- UI вызывает core, core никогда не вызывает UI;
- legacy-дубликаты (`public/vampires/vtm-health.js`, `public/vampires/vtm-humanity.js`) меняются
  только осознанно и синхронно.

Состав VTM core:

- trackers: health, willpower, humanity, hunger;
- rolls: d10 pool, hunger dice, messy critical, bestial failure, opposed rolls;
- blood: rouse checks, blood surge, blood potency helpers;
- disciplines: schema, costs, durations, effects, active effects, rules loader;
- derived stats;
- character normalization helpers, если они не завязаны на Supabase/UI.

## VTM5 Core

`games/vampires/core/vtm5/` - фактический дом VTM5 core после переноса из `lib/vtm/`.
Публичная точка входа системы: `games/vampires/core/vtm5/index.ts`, barrel правил:
`games/vampires/core/vtm5/rules/index.ts`.

Структура:

- `rules/health/`, `rules/humanity/`, `rules/damage/`,
  `rules/derived-stats/` - правила трекеров, урона и производных статов;
- `rules/disciplines/*` - schema, loader, engine, costs, durations, effects,
  active effects and legacy cost parsing;
- `adapters/` - адаптеры между чистыми правилами и module contracts (`table`, `rolls`);
- `system-core.ts` - `createVtm5SystemCore()` отдаёт систему и адаптеры модулям.

Правило зависимости: `games/vampires/core/vtm5/rules/*` может импортировать только
чистые helpers, типы и rules data adapters. UI, Supabase, React и browser APIs
должны оставаться вне core.

### 3. Pluggable Modules

Модуль - feature-область, которую Hub подключает через стабильный контракт.
Модуль может иметь UI, hooks, services, realtime и storage adapters, но его
внутренняя логика не должна расползаться в `app/layout.tsx` или `GameTable.tsx`.

Текущие и будущие модули:

- `table` - игровой стол, сцены, слои, canvas, чат, броски, master tools;
- `character-sheet` - shell + legacy bridge, позже React-лист;
- `music` - playback, library, scene music, adapters;
- `journal` - дневник;
- `reference` - справочник;
- `media` - загрузки, library, preview, storage helpers;
- `rules` - правила и rules data browser, если появится отдельно.

Минимальный контракт модуля:

- `id` и человекочитаемое имя;
- routes или компоненты, которые Hub может подключить;
- какие capabilities модуль предоставляет (`rolls`, `scene-media`, `music`,
  `character-sheet`, `journal`);
- какие Supabase tables/buckets он использует;
- какие browser contracts нужны (`postMessage`, `localStorage`, global events);
- какие core-системы поддерживает (`vtm` сейчас, другие возможны позже).

## Supabase и shared contracts

Supabase - общий контракт для legacy и React-зоны. Нельзя переименовывать таблицы,
buckets или форму сохранённых данных как часть архитектурного рефакторинга.

Правила:

- table/bucket names должны быть централизованы в constants-файлах;
- row -> app mappings должны идти через mappers;
- API-слой модулей должен оборачивать существующие запросы, не менять схему;
- изменения схемы требуют migration note и записи в `docs/ai/DECISIONS.md`;
- старые сохранённые персонажи и комнаты должны продолжать открываться.

## Legacy-зона

Legacy-лист остаётся load-bearing частью проекта:

- `public/vampires/old-sheet.html`;
- `public/vampires/main.js`;
- `public/vampires/supabase.js`;
- `public/vampires/creation-wizard.js`;
- `public/vampires/vtm-health.js`;
- `public/vampires/vtm-humanity.js`;
- `public/vampires/i18n-runtime.js`;
- `public/vampires/i18n-dictionary.js`;
- `public/vampires/rules.json`;
- `public/vampires/rules_eng.json`.

Текущий мост:

```txt
/character-sheet
  -> components/screens/CharacterSheetScreen.tsx
  -> iframe /vampires/old-sheet.html?room=&role=&characterId=&new=
  -> public/vampires/main.js + public/vampires/supabase.js
  <- postMessage { type: 'vtm-character-saved', characterId }
```

Правила legacy:

- не переписывать `public/vampires/main.js` и `old-sheet.html` широким движением;
- не добавлять новую VTM-логику в `public/vampires/main.js`;
- не ломать query params: `room`, `role`, `characterId`, `new`;
- не менять `vtm-character-saved` postMessage без отдельного решения;
- не менять `characters` row shape без миграции;
- legacy-дубликаты VTM-механик держать в синхроне с
  `games/vampires/core/vtm5/rules/*`.

## Миграционный план

### Фаза 0. Зафиксировать границы

Цель: ничего не переносить, пока не описаны контракты.

Шаги:

- держать `app/*/page.tsx` тонкими route shells;
- зафиксировать текущую роль `app/layout.tsx` как Hub shell;
- описать table, character-sheet, music, journal, reference как будущие modules;
- не менять runtime-поведение;
- после любой реальной правки кода запускать `npm run build`.

### Фаза 1. Самые безопасные извлечения

Цель: вынести чистые функции без изменения UI и Supabase.

Кандидаты:

- `rollD10Pool`, `countD10Successes`, `getRollOutcomeMeta`, die kind helpers из
  `GameTable.tsx` -> `games/vampires/core/vtm5/rules/rolls/`;
- hunger/rouse/blood surge helpers -> `games/vampires/core/vtm5/rules/hunger/` и
  `games/vampires/core/vtm5/rules/blood/`;
- willpower tracker helpers -> `games/vampires/core/vtm5/rules/willpower/`;
- pure table helpers для layer tree, selection, ordering -> `lib/table/*`;
- room/role URL/localStorage helpers -> `lib/table/session.ts` или
  `lib/hub/session.ts`, но только если bridge-контракт остаётся прежним;
- music table/bucket constants -> общий constants-слой без переименования
  `table_music`, `table_music_library`, `table-music`.

Почему это безопасно: функции можно перенести с re-export или прямой заменой
import, покрыть типами, и они не требуют изменения DOM, schema или realtime.

### Фаза 2. Supabase API слой для table-модуля

Цель: убрать прямые `createClient().from(...)` из `GameTable.tsx` по одному
feature-срезу.

Будущие файлы:

```txt
lib/table/api/
  rolls.ts
  chat.ts
  characters.ts
  scenes.ts
  layers.ts
  scene-music.ts
```

Правила:

- API-функции используют существующие constants и mappers;
- имена таблиц не меняются;
- поведение fallback-запросов сохраняется;
- `GameTable.tsx` сначала просто вызывает новые функции;
- после каждого среза: `npm run lint`, затем `npm run build`.

Безопасный порядок:

1. read-only loaders: roll history, scene list (`chat` already moved to
   `games/vampires/modules/chat/api/chat-api.ts`);
2. simple inserts: roll insert (`chat message` already moved to
   `games/vampires/modules/chat/api/chat-api.ts`);
3. scene CRUD;
4. layer/media CRUD;
5. character updates, только после отдельной проверки `characters` contract.

### Фаза 3. Hooks и локальные контексты table-модуля

Цель: `GameTable.tsx` остаётся оркестратором, но перестаёт хранить весь мир в
одном компоненте.

Кандидаты:

```txt
games/vampires/modules/table/hooks/
  useTableSession.ts
  useTableRealtime.ts
  useRolls.ts
  useScenes.ts
  useLayers.ts
  useTableMedia.ts
  useMasterTools.ts
```

На переходном этапе эти hooks могут жить в `components/table/hooks/` или
`lib/table/hooks/`. Важно не место, а граница: hook владеет одним срезом
состояния и одним набором side effects.

Поздние hooks:

- `useVoiceChat` - из-за WebRTC и browser permissions;
- `useMusicSync` - из-за autoplay, YouTube/file adapters и global engine;
- `useCharacterSheetBridge` - из-за iframe/postMessage контракта.

### Фаза 4. Реорганизация UI в modules

Цель: переместить компоненты в feature-папки после того, как логика уже вынесена
в hooks/services.

Порядок:

1. `components/table/{SceneManager,LayerManager,MediaLibrary}` ->
   `games/vampires/modules/table/components/{scenes,layers,media}/`;
2. `TableCanvas` -> `games/vampires/modules/table/components/canvas/`;
3. `MasterPanel`, `JournalPanel` -> соответствующие module folders
   (`ChatPanel` уже перенесён в `games/vampires/modules/chat/components/`);
4. `DiceRollOverlay` -> `games/vampires/modules/table/components/rolls/`, но 3D/rendering
   оставить изолированным от VTM core;
5. `GameTableStyles.tsx` дробить последним и только вместе с визуальной проверкой.

До этого этапа можно оставить старые paths и добавлять только re-export files,
чтобы PR не становился механическим переносом сотен imports.

### Фаза 5. Legacy bridge как character-sheet module

Цель: не заменить legacy-лист, а обернуть его контрактом.

Будущие файлы:

```txt
games/vampires/modules/character-sheet/
  CharacterSheetRoute.tsx
  legacy/
    bridge.ts
    params.ts
    events.ts
    storage.ts
```

Шаги:

- вынести сборку iframe URL в чистую функцию;
- вынести обработку `vtm-character-saved` в typed helper;
- сохранить origin check;
- сохранить localStorage keys;
- не трогать `public/vampires/main.js` без отдельного task.

### Фаза 6. Core relocation

Статус: базовый перенос `lib/vtm/*` в `games/vampires/core/vtm5/rules/*` выполнен.
Дальнейшие шаги должны только уточнять внутреннюю структуру core и добавлять
адаптеры без изменения поведения правил.

Вариант перехода:

```txt
games/vampires/core/vtm5/
  index.ts
  types.ts
  rules/
    health/
    humanity/
    damage/
    derived-stats/
    disciplines/
  adapters/

lib/vtm/*
  // больше не используется как runtime location
```

После этой фазы следующий безопасный шаг - перенос оставшихся pure helpers из
`GameTable.tsx` в `games/vampires/core/vtm5/rules/*` или adapters с отдельной проверкой
поведения.

## Финальная структура папок

Целевая структура. Это не инструкция сделать всё одним PR.

```txt
app/
  layout.tsx
  page.tsx
  character-sheet/page.tsx
  table/page.tsx
  journal/page.tsx
  reference/page.tsx

core/
  infrastructure/
  hub/
    index.ts
    types.ts
  systems/
    vtm5/
      index.ts
      types.ts
      rules/
        health/
        humanity/
        damage/
        derived-stats/
        disciplines/
          active-effects/
          character-disciplines/
          costs/
          durations/
          effects/
          engine/
          legacy-cost-parser/
          rules-loader/
          schema/
      adapters/

games/vampires/modules/
  table/
    TableRoute.tsx
    GameTable.tsx
    components/
      canvas/
      panels/
      scenes/
      layers/
      media/
      rolls/
      master/
      voice/
    hooks/
      useTableSession.ts
      useTableRealtime.ts
      useRolls.ts
      useScenes.ts
      useLayers.ts
      useTableMedia.ts
    services/
      rolls.ts
      characters.ts
      scenes.ts
      layers.ts
      scene-music.ts
    contracts/
      constants.ts
      events.ts
      types.ts
      mappers.ts

  chat/
    components/
      ChatPanel.tsx
    hooks/
      useChat.ts
    api/
      chat-api.ts
    types.ts

  character-sheet/
    CharacterSheetRoute.tsx
    components/
    legacy/
      bridge.ts
      params.ts
      events.ts
      storage.ts

  music/
    components/
    hooks/
    services/
    adapters/
      localAudioAdapter.ts
      youtubeAdapter.ts
    contracts/
      constants.ts
      types.ts
      mappers.ts

  journal/
    components/
    services/

  reference/
    components/
    services/

lib/
  hub/
    types.ts
    module-registry.ts
    session.ts
    permissions.ts
  games/vampires/supabase/
    client.ts
    browser.ts
  i18n/
    LanguageProvider.tsx
    dictionary.ts
    ruleNames.ts
  table/
    // transitional re-exports while games/vampires/modules/table/contracts is introduced
  vtm/
    // transitional re-exports while games/vampires/core/vtm5 is introduced

public/
  old-sheet.html
  main.js
  supabase.js
  creation-wizard.js
  vtm-health.js
  vtm-humanity.js
  i18n-runtime.js
  i18n-dictionary.js
  rules.json
  rules_eng.json
  static/
  reference/
```

## Что извлекать первым

Самые безопасные первые модули:

- чистые dice helpers из `GameTable.tsx` в `games/vampires/core/vtm5/rules/rolls/`;
- willpower/hunger/blood surge helpers в `games/vampires/core/vtm5/rules/*`;
- дополнительные pure layer/scene/media helpers в `lib/table/*`;
- table/music constants в общий contracts-слой без изменения значений;
- Supabase read-only loaders в `lib/table/api/*`;
- typed bridge helpers для `CharacterSheetScreen`, если iframe URL и
  postMessage shape не меняются.

Средний риск:

- roll publish + fallback meta insert;
- chat message insert/auth helpers;
- scene CRUD и scene music;
- layer/media CRUD;
- разбиение `GameTable.tsx` на hooks;
- перенос table-компонентов в подпапки с re-export shims.

Позже и только отдельными задачами:

- realtime channel extraction целиком;
- WebRTC voice chat;
- music sync/playback/global engine;
- `characters` table writes and character data shape;
- замена legacy-листа React-листом;
- перенос `public/vampires/rules.json` / `rules_eng.json` schema;
- дробление `GameTableStyles.tsx`;
- дальнейшая внутренняя реорганизация `games/vampires/core/vtm5/rules/*` без изменения
  поведения.

## Правила дальнейших изменений

- Не переписывать `GameTable.tsx` широким PR. Он должен уменьшаться
  инкрементально.
- Не добавлять новую VTM-логику в `public/vampires/main.js`.
- Не менять VTM-правила во время архитектурного переноса.
- Не менять Supabase table/bucket names без миграционного решения.
- Не менять форму сохранённых персонажей или комнат без migration note.
- Не переносить UI-файлы массово до извлечения API/hooks-границ.
- Сохранять старые imports через re-export shims, если перенос иначе становится
  шумным.
- Каждый значимый code-step проходит `npm run lint` и `npm run build`.
- Для дисциплин дополнительно запускать `npm run audit:disciplines`,
  `npm run validate:disciplines`, `npm run test:disciplines`.
- Для table-изменений проверять `/table?room=campaign-666&role=master` и
  `/table?room=campaign-666&role=player`.
- Для legacy bridge проверять `/character-sheet`, `/character-sheet?new=1` и
  сохранение персонажа с обновлением `characterId` в URL.

## Definition of Done для архитектурного шага

Шаг считается завершённым, если:

- пользовательское поведение не изменилось или изменение явно описано;
- старые данные продолжают загружаться;
- `GameTable.tsx` не вырос без причины;
- VTM core остался чистым;
- Supabase contracts не изменились случайно;
- нужные проверки запущены и результат зафиксирован;
- `docs/ai/DECISIONS.md` обновлён, если шаг является архитектурным решением.
