# Master Overview — «Обзор ночи»

Command center for `/master`. Aggregates existing domain data; does not copy
character sheets, rolls, or scenes into a parallel store.

## Sections

| Section | Source |
|---|---|
| Котерия | `chronicle_actors` (PC) + linked `characters` via actors normalizer |
| НПС сцены | actors with `current_scene_id` = active `table_scenes` |
| Сюжеты | `master_plot_hooks` (+ localStorage fallback) |
| Заметки | `master_session_notes` autosave debounce (+ local fallback) |
| Лента | `master_action_log` + public `table_rolls` |
| Макросы | actors hunger + master-rolls rouse/frenzy/pool |

## Rules

- Cards deep-link to actors module / full sheet route.
- Warnings are pure selectors (`selectors/warnings-selectors.ts`).
- Empty chronicle shows empty working panels, never demo seed data.
- Notes default visibility `master`.
