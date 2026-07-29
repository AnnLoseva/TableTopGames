# Карта интерфейсных референсов

## Статус исходников

На момент аудита (2026-07-11) в доступном attachment-каталоге присутствует
только `pasted-text.txt`. Файлы `Обзор ночи.mhtml`, `НПС.mhtml`, `Сцены и
Слои.mhtml`, `Лор и таблицы.mhtml`, `Узы крови.mhtml`, `Журнал Сессии.mhtml` не
найдены ни во вложениях, ни в репозитории. Поэтому ниже зафиксирована
**предварительная продуктовая карта по ТЗ**, а не визуальный pixel/layout audit.
До UI-реализации нужен короткий follow-up PR: приложить MHTML, проверить DOM,
скриншоты, размеры, состояния и заменить все пометки «не подтверждено».

## Общая структура (из ТЗ, визуально не подтверждена)

Все шесть экранов должны жить в одной shell-композиции: постоянный top bar,
левая колонка макросов/модулей/раскладок, центральные окна и постоянная правая
rail. Уникальным является содержимое центрального окна, а не отдельная копия
навигации или роллера.

| Референс | Центральная структура и действия | Редактируемые данные | Приватность | Переиспользование |
|---|---|---|---|---|
| Обзор ночи | Dashboard карточек с текущей сценой, участниками, угрозами, последствиями и quick actions; точные колонки не подтверждены | session/night, планы, заметки, последствия | планы/заметки/последствия private; published scene shared | room bootstrap, scene API/hooks, character loader, rolls, music |
| НПС | каталог + detail inspector; фильтры/точная геометрия не подтверждены | actor profile, stats, tags, links, secrets | `ActorPrivateFields` master-only | character mapper/preview patterns, VTM5 adapters, roll factory; не таблица `characters` без решения контракта |
| Сцены и Слои | scene list + layer/media workspace + inspector; точные колонки не подтверждены | scene, layer, media placement, interactive objects, music | draft/traps/GM layer private; published projection shared | `scene-api`, `layer-api`, `useTableScenes`, `useTableLayers`, SceneManager, LayerManager, MediaLibrary, music |
| Лор и таблицы | category tree/list + entry editor/preview + links; точные колонки не подтверждены | categories, entries, links, visibility | draft private; explicit publish | `src/games/vampires/modules/reference` renderer/catalog patterns, JournalEditor for rich text |
| Узы крови | bond graph/list + details/event history; вид графа не подтверждён | bonds, levels, events, notes | master-only until reveal | character/actor identity references, VTM display adapters; новая domain model |
| Журнал Сессии | chronological feed + editor/filters; точные колонки не подтверждены | log entries, notes, consequences, publication | master entries private by default; selected summary publishable | `JournalEditor`, roll/scene/action event adapters |

## Постоянные и уникальные компоненты

Постоянные: `MasterConsoleShell`, `MasterTopBar`, `MacroRail`, `ModuleCatalog`,
`LayoutPicker`, `MasterRightRail`, connection indicator, permission boundary и
window chrome. Уникальные: шесть module roots и их domain-specific editors.
Компоненты shell не должны импортировать `GameTable.tsx`.

## Обязательная повторная проверка после получения MHTML

Для каждого файла зафиксировать viewport, реальные ширины колонок, sticky/fixed
области, hierarchy/labels/icons, hover/focus/expanded состояния, контекстные
меню, forms, empty/loading/error состояния и responsive behavior. Затем связать
каждый визуальный элемент с существующим компонентом или новым владельцем и
сохранить screenshots/DOM notes рядом с этим документом. До этого acceptance
criterion «все шесть референсов разобраны» объективно не выполнен.

