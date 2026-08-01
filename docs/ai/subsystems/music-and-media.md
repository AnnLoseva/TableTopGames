# Music and Media

## Purpose
Everything visual and audible on the game table: images/videos/files placed on
the canvas and organized into layers within scenes, plus a music system with
local-audio and YouTube sources, synced across the room.

## Main files
- Music UI/logic: `src/games/vampires/modules/music/components/MusicPlayer.tsx`,
  `src/games/vampires/modules/music/MusicSyncEngine.ts`, `src/games/vampires/modules/music/types.ts`,
  `src/games/vampires/modules/music/utils.ts`.
- Persistent global player mount:
  `src/games/vampires/modules/music/components/GlobalMusicEngineMount.tsx` in `src/app/layout.tsx`.
- Music adapters: `src/games/vampires/modules/music/adapters/localAudioAdapter.ts`,
  `src/games/vampires/modules/music/adapters/youtubeAdapter.ts`.
- Table media/layers: `src/games/vampires/modules/table/components/{canvas,media,layers,scenes}/*`.
- Media/layer/scene helpers: `src/games/vampires/modules/table/utils/{media-utils,layer-utils,scene-utils}.ts`.
- Data: `table_images` (including background candidates), `table_music`,
  `table_music_library`, `table_scene_music`, `media_studio_layers`; buckets `table-images` + music
  bucket (see `supabase-persistence.md`).

## Images / video / files / layers
- Media items live on the tldraw canvas (`TableCanvas.tsx`) and are grouped into
  **layers** inside a **scene**. Visibility is scene/layer driven.
- The media toolbar intentionally has only **Upload** and **Folder**. Upload opens
  one chooser for files, a whole folder (preserving nested relative paths), or a
  background image. Folders are `table_images` folder rows nested inside the
  image/media tree; there is no separate folders section.
- `table_images.is_background=true` marks reusable background candidates. They
  are off-table, excluded from the ordinary media library and surfaced in
  Layers → Background, where one click updates the active scene background.
- Layers → Images/Decorations, Text/Documents and Tokens are working sections.
  Text creation lives in Text/Documents. Shift/Ctrl/Cmd click toggles individual
  media selection; Shift-drag on empty list space adds every intersecting row.
- The master image context menu is deliberately object-focused: point everyone,
  copy image, set background, rename, hide, lock, layer order, move to folder,
  delete (in that order). Canvas-only opacity/position controls do not appear there.
- Root layer drop target id is `ROOT_LAYER_DROP_ID` (`__root__`) in
  `src/games/vampires/modules/table/constants.ts`.
- Use `src/games/vampires/modules/table/utils/{layer,scene,media}-utils.ts` for placement/visibility logic —
  don't reimplement inline in `GameTable.tsx`.

## Music system
- `MusicSyncEngine.ts` coordinates playback state across the room (realtime).
- Adapters abstract the source: local uploaded audio vs YouTube. Each has its own
  loading, seeking, and error behavior.
- `GlobalMusicEngineMount` keeps the hidden engine mounted from
  `src/app/(vampires)/vampires/layout.tsx`, so playback survives VTM navigation without
  mounting on Pathfinder routes.
- Persistence: current music via `table_music`, per-scene via `table_scene_music`,
  a reusable library via `table_music_library`; audio files in the music bucket.
- Scene music is intentionally the larger lower section of the Scenes tab; the
  separate Music tab remains available for the room-level player/library UI.

## Browser & platform limitations
- **Autoplay is blocked** until a user gesture — playback must be gated on
  interaction; do not assume audio starts on load.
- **YouTube** embeds have their own constraints (embeddable flag, region, ads,
  the IFrame API lifecycle) — handle failures gracefully in `youtubeAdapter.ts`.
- Cross-room sync means one client's play/seek propagates; guard against loops
  and stale state.

## Known risks
- Autoplay/gesture handling regressions (silent failures).
- Adapter error paths (a bad URL or non-embeddable video).
- Media/layer/scene references pointing at deleted Supabase rows.
- Sync races between clients.

## Safe edit protocol
1. Read `../workflows/react-table-edit-protocol.md`.
2. Keep source-specific logic inside the adapters; keep placement logic in
   `src/games/vampires/modules/table/utils/*`.
3. Preserve gesture-gated playback.
4. Verify: open the music panel in `/vampires/table`, load local + YouTube, confirm
   play/seek and that scene switching shows the right media/layers.

## Related docs
`game-table.md`, `supabase-persistence.md`.
