# Master Scenes

Master-console shell around **existing** `table_scenes`, `table_images`,
`table_scene_music` and room `table_music`. No second scene/canvas engine.

## Contracts

| Concern | Owner |
|---|---|
| Scene rows / active publish | `table_scenes.is_active` + `scene-active` broadcast |
| Layers | `table_images` via `src/games/vampires/modules/table/api/layer-api` |
| GM vs players | `owner_role`; players never render `owner_role=master` |
| Draft vs publish | preview selects any scene; publish activates + logs |
| Light presets | data in `utils/light-presets.ts` + `master_scene_meta` |
| Interactives | `master_scene_objects` (+ public projection without secrets) |
| Music | `playSceneMusicTrack` → `table_music` (global engine) |

## Do not

- Import `GameTable.tsx`
- Duplicate playback engines
- Auto-activate scene on every edit
